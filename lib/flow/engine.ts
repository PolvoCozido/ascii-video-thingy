"use client";

import type { Edge, Node } from "@xyflow/react";
import { callChat, callMedia } from "@/lib/client";
import { readKeySync } from "@/lib/keys";
import { getSpec } from "@/lib/models/registry";
import type { ModelSpec } from "@/lib/models/types";
import {
  isModelDrivenKind,
  STATIC_IO,
  type NodeConfig,
  type NodeData,
} from "./types";

export type FlowNode = Node;
export type FlowEdge = Edge;

function dataOf(n: FlowNode): NodeData {
  return n.data as unknown as NodeData;
}

export type RunEvent =
  | { type: "start"; nodeId: string }
  | { type: "done"; nodeId: string; output: NonNullable<NodeData["output"]>; inputs: Record<string, string | undefined>; cfg: NodeConfig }
  | { type: "error"; nodeId: string; error: string }
  | { type: "skip"; nodeId: string; reason: string };

export function topoSort(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const idSet = new Set(nodes.map((n) => n.id));
  const incoming = new Map<string, Set<string>>();
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) {
    incoming.set(n.id, new Set());
    adj.set(n.id, new Set());
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    incoming.get(e.target)!.add(e.source);
    adj.get(e.source)!.add(e.target);
  }
  const ready: string[] = [];
  for (const [id, deps] of incoming) if (deps.size === 0) ready.push(id);
  const out: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    out.push(id);
    for (const child of adj.get(id)!) {
      const deps = incoming.get(child)!;
      deps.delete(id);
      if (deps.size === 0) ready.push(child);
    }
  }
  if (out.length !== nodes.length) {
    for (const n of nodes) if (!out.includes(n.id)) out.push(n.id);
  }
  return out;
}

function descendantsOf(startId: string, nodes: FlowNode[], edges: FlowEdge[]): Set<string> {
  const idSet = new Set(nodes.map((n) => n.id));
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    adj.get(e.source)!.add(e.target);
  }
  const visited = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const child of adj.get(id) ?? []) stack.push(child);
  }
  return visited;
}

/** Resolve the handle names this node accepts, given its current config. */
export function effectiveInputs(cfg: NodeConfig): string[] {
  if (isModelDrivenKind(cfg.kind)) {
    const md = cfg as { provider: import("@/lib/providers/types").ProviderId; model: string };
    const spec = getSpec(md.provider, md.model);
    if (spec) return spec.inputs.map((i) => i.name);
    return [];
  }
  return STATIC_IO[cfg.kind]?.inputs ?? [];
}

export function effectiveOutputs(cfg: NodeConfig): string[] {
  if (isModelDrivenKind(cfg.kind)) {
    const md = cfg as { provider: import("@/lib/providers/types").ProviderId; model: string };
    const spec = getSpec(md.provider, md.model);
    if (!spec) return [];
    return [spec.output === "text" ? "text" : "media"];
  }
  return STATIC_IO[cfg.kind]?.outputs ?? [];
}

function gatherInputs(
  nodeId: string,
  edges: FlowEdge[],
  outputs: Map<string, NonNullable<NodeData["output"]>>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const e of edges) {
    if (e.target !== nodeId) continue;
    const src = outputs.get(e.source);
    if (!src) continue;
    const handle = e.targetHandle;
    if (!handle) continue;
    if (src.text != null && result[handle] === undefined) result[handle] = src.text;
    if (src.media != null && result[handle] === undefined) result[handle] = src.media.url;
  }
  return result;
}

async function runNode(
  cfg: NodeConfig,
  inputs: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<NonNullable<NodeData["output"]>> {
  switch (cfg.kind) {
    case "text": {
      return { text: cfg.text };
    }
    case "upload": {
      if (!cfg.url || !cfg.mediaType) throw new Error("upload node has no file");
      return { media: { url: cfg.url, mediaType: cfg.mediaType } };
    }
    case "ascii": {
      const inputUrl = inputs.media;
      if (!inputUrl) throw new Error("ascii needs a media input");
      return { media: { url: inputUrl, mediaType: guessMediaType(inputUrl) } };
    }
    case "convert": {
      const inputUrl = inputs.media;
      if (!inputUrl) throw new Error("convert needs a media input");
      const { convertToMp4 } = await import("@/lib/convert/ffmpeg");
      const mp4Url = await convertToMp4(inputUrl, undefined, signal);
      return { media: { url: mp4Url, mediaType: "video" } };
    }
    case "prompt":
    case "imageGen":
    case "videoGen": {
      return runModelDriven(cfg, inputs, signal);
    }
  }
}

async function runModelDriven(
  cfg: Extract<NodeConfig, { kind: "prompt" | "imageGen" | "videoGen" }>,
  inputs: Record<string, string | undefined>,
  signal?: AbortSignal,
): Promise<NonNullable<NodeData["output"]>> {
  const spec = getSpec(cfg.provider, cfg.model);
  if (!spec) throw new Error(`unknown model: ${cfg.provider}/${cfg.model}`);

  // Validate required inputs are present
  for (const i of spec.inputs) {
    if (i.required && !inputs[i.name]) {
      throw new Error(`missing required input: ${i.name}`);
    }
  }

  // For prompt nodes, inject the node's `context` into the chat config's `system` if user didn't set one
  const params: Record<string, unknown> = { ...cfg.params };
  if (cfg.kind === "prompt") {
    if (!params.system || params.system === "") {
      params.system = cfg.context;
    }
  }

  const payload = spec.buildPayload({ inputs, config: params });

  const apiKey = readKeySync(cfg.provider);
  if (!apiKey) throw new Error(`no ${cfg.provider} api key — open settings`);

  if (spec.output === "text") {
    const text = await callChat({
      provider: cfg.provider,
      modelId: cfg.model,
      payload,
      apiKey,
      signal,
    });
    return { text };
  } else {
    const result = await callMedia({
      provider: cfg.provider,
      modelId: cfg.model,
      payload,
      apiKey,
      signal,
    });
    return { media: { url: result.url, mediaType: result.mediaType } };
  }
}

export async function runFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  onEvent: (e: RunEvent) => void,
  signal?: AbortSignal,
  opts?: { from?: string },
): Promise<void> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outputs = new Map<string, NonNullable<NodeData["output"]>>();

  // Pre-load existing outputs so partial runs can use cached upstream values.
  for (const n of nodes) {
    const out = dataOf(n).output;
    if (out) outputs.set(n.id, out);
  }

  const fullOrder = topoSort(nodes, edges);
  const subset = opts?.from ? descendantsOf(opts.from, nodes, edges) : null;
  const order = subset ? fullOrder.filter((id) => subset.has(id)) : fullOrder;

  for (const id of order) {
    if (signal?.aborted) return;
    const node = byId.get(id);
    if (!node) continue;
    const cfg = dataOf(node).config;
    const inputs = gatherInputs(id, edges, outputs);

    // Skip nodes whose required inputs are missing
    const requiredInputs = requiredInputNames(cfg);
    const missing = requiredInputs.filter((name) => !inputs[name]);
    if (missing.length > 0) {
      onEvent({ type: "skip", nodeId: id, reason: `missing: ${missing.join(", ")}` });
      continue;
    }

    onEvent({ type: "start", nodeId: id });
    try {
      const output = await runNode(cfg, inputs, signal);
      outputs.set(id, output);
      onEvent({ type: "done", nodeId: id, output, inputs, cfg });
    } catch (err) {
      onEvent({ type: "error", nodeId: id, error: (err as Error).message });
    }
  }
}

/**
 * Best-effort media type from a URL's file extension. If the URL is wrapped in
 * our same-origin proxy (`/api/proxy?url=...`), unwrap to look at the original.
 * Falls back to "image" — preview will fail loudly if a video is misclassified.
 */
function guessMediaType(url: string): "image" | "video" {
  let real = url;
  if (url.startsWith("/api/proxy?")) {
    try {
      const params = new URL(url, "http://x").searchParams;
      const inner = params.get("url");
      if (inner) real = inner;
    } catch {
      // fall back to the wrapped URL
    }
  }
  const ext = real.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "webm", "mov", "m4v"].includes(ext) ? "video" : "image";
}

function requiredInputNames(cfg: NodeConfig): string[] {
  if (isModelDrivenKind(cfg.kind)) {
    const md = cfg as { provider: import("@/lib/providers/types").ProviderId; model: string };
    const spec: ModelSpec | undefined = getSpec(md.provider, md.model);
    if (!spec) return [];
    return spec.inputs.filter((i) => i.required).map((i) => i.name);
  }
  if (cfg.kind === "ascii" || cfg.kind === "convert") return ["media"];
  return [];
}
