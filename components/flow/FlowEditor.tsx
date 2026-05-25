"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { runFlow, type FlowEdge, type FlowNode } from "@/lib/flow/engine";
import { setRunFromNodeHandler } from "@/lib/flow/control";
import { seedGraph } from "@/lib/flow/seed";
import { getSpec } from "@/lib/models/registry";
import { defaultParams } from "@/lib/models/types";
import type { FlowNodeKind, NodeData } from "@/lib/flow/types";
import { STYLE_DEFAULTS } from "@/lib/style";
import { readPicksSync } from "@/lib/keys";
import { SettingsDrawer, useSettingsToggle } from "../SettingsDrawer";
import { TextNode } from "./nodes/TextNode";
import { PromptNode } from "./nodes/PromptNode";
import { UploadNode } from "./nodes/UploadNode";
import { ProviderNode } from "./nodes/ProviderNode";
import { AsciiNode } from "./nodes/AsciiNode";
import { DEFAULT_PROMPT_CONTEXT } from "@/lib/flow/types";

function ImageGenNodeAdapter(props: NodeProps) {
  return <ProviderNode {...props} kind="imageGen" />;
}
function EditNodeAdapter(props: NodeProps) {
  return <ProviderNode {...props} kind="edit" />;
}
function VideoGenNodeAdapter(props: NodeProps) {
  return <ProviderNode {...props} kind="videoGen" />;
}

const NODE_TYPES: NodeTypes = {
  text: TextNode,
  prompt: PromptNode,
  upload: UploadNode,
  imageGen: ImageGenNodeAdapter,
  edit: EditNodeAdapter,
  videoGen: VideoGenNodeAdapter,
  ascii: AsciiNode,
};

const STORAGE_KEY = "ascii-video-thingy:flow:v3";

function loadSaved(): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nodes: FlowNode[]; edges: FlowEdge[] };
    return parsed;
  } catch {
    return null;
  }
}

function persist(nodes: FlowNode[], edges: FlowEdge[]) {
  if (typeof window === "undefined") return;
  try {
    // strip runtime fields before saving so old errors don't persist
    const cleanNodes = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        status: "idle" as const,
        error: undefined,
        // keep upload outputs (they reference blob: or /sample.mp4), drop AI outputs
        output:
          n.type === "upload"
            ? (n.data as unknown as NodeData).output
            : undefined,
      },
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: cleanNodes, edges }));
  } catch {
    // ignore
  }
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}

function FlowEditorInner() {
  const seedRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  if (seedRef.current === null) {
    seedRef.current = loadSaved() ?? seedGraph();
  }
  const seed = seedRef.current;

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(seed.edges);
  const [running, setRunning] = useState(false);
  const [scissor, setScissor] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { isOpen, toggle } = useSettingsToggle();

  // persist on change
  useEffect(() => {
    persist(nodes, edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge({ ...conn, animated: true }, eds)),
    [setEdges],
  );

  const updateNodeRuntime = useCallback(
    (nodeId: string, patch: Partial<NodeData>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...(n.data as unknown as NodeData),
                  ...patch,
                } as unknown as Node["data"],
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const handleRun = useCallback(
    async (opts?: { from?: string }) => {
      if (running) {
        abortRef.current?.abort();
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);

      // reset statuses for nodes that will be re-executed
      setNodes((prev) =>
        prev.map((n) => {
          if (n.type === "upload") return n;
          // If partial-running, only reset start node + descendants; leave others as-is.
          // Engine will recompute descendants — we reset broadly here for simplicity.
          return {
            ...n,
            data: {
              ...(n.data as unknown as NodeData),
              status: "idle",
              error: undefined,
            } as unknown as Node["data"],
          };
        }),
      );

      try {
        await runFlow(
          nodes as FlowNode[],
          edges as FlowEdge[],
          (evt) => {
            if (evt.type === "start") {
              updateNodeRuntime(evt.nodeId, { status: "running", error: undefined });
            } else if (evt.type === "done") {
              updateNodeRuntime(evt.nodeId, { status: "done", output: evt.output, error: undefined });
            } else if (evt.type === "error") {
              updateNodeRuntime(evt.nodeId, { status: "error", error: evt.error });
            } else if (evt.type === "skip") {
              updateNodeRuntime(evt.nodeId, { status: "idle", error: undefined });
            }
          },
          ctrl.signal,
          opts,
        );
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [running, nodes, edges, setNodes, updateNodeRuntime],
  );

  // Bridge node ▶ buttons → partial run
  useEffect(() => {
    setRunFromNodeHandler((nodeId) => {
      void handleRun({ from: nodeId });
    });
    return () => setRunFromNodeHandler(null);
  }, [handleRun]);

  // Esc exits scissor mode
  useEffect(() => {
    if (!scissor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScissor(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scissor]);

  const onEdgeClick = useCallback(
    (_evt: React.MouseEvent, edge: Edge) => {
      if (!scissor) return;
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [scissor, setEdges],
  );

  const addNode = useCallback(
    (kind: FlowNodeKind) => {
      const id = `${kind}-${Date.now().toString(36)}`;
      const picks = readPicksSync();
      let data: NodeData;
      let type: string = kind;
      const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

      const specOf = (p: typeof picks.chat) => {
        const s = getSpec(p.provider, p.model);
        return { spec: s, params: s ? defaultParams(s) : {} };
      };

      switch (kind) {
        case "text":
          data = { config: { kind: "text", text: "" }, status: "idle" };
          break;
        case "prompt": {
          const { params } = specOf(picks.chat);
          data = {
            config: {
              kind: "prompt",
              context: DEFAULT_PROMPT_CONTEXT,
              provider: picks.chat.provider,
              model: picks.chat.model,
              params,
            },
            status: "idle",
          };
          break;
        }
        case "upload":
          data = { config: { kind: "upload" }, status: "idle" };
          break;
        case "imageGen": {
          const { params } = specOf(picks.image);
          data = {
            config: { kind: "imageGen", provider: picks.image.provider, model: picks.image.model, params },
            status: "idle",
          };
          break;
        }
        case "edit": {
          const { params } = specOf(picks.edit);
          data = {
            config: { kind: "edit", provider: picks.edit.provider, model: picks.edit.model, params },
            status: "idle",
          };
          break;
        }
        case "videoGen": {
          const { params } = specOf(picks.video);
          data = {
            config: { kind: "videoGen", provider: picks.video.provider, model: picks.video.model, params },
            status: "idle",
          };
          break;
        }
        case "ascii":
          data = { config: { kind: "ascii", style: { ...STYLE_DEFAULTS } }, status: "idle" };
          break;
      }

      setNodes((prev) => [
        ...prev,
        {
          id,
          type,
          position,
          data: data as unknown as Node["data"],
        },
      ]);
    },
    [setNodes],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-rule)] px-4 py-2">
        <div className="flex items-baseline gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">ascii::thingy</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
            {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} edge
            {edges.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AddMenu onAdd={addNode} />
          <button
            type="button"
            onClick={() => setScissor((s) => !s)}
            title={scissor ? "exit cut mode (esc)" : "click edges to cut them"}
            className={[
              "border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition",
              scissor
                ? "border-[color:var(--color-rec)] bg-[color:var(--color-rec)] text-[color:var(--color-bg)] hover:opacity-90"
                : "border-[color:var(--color-rule)] text-[color:var(--color-muted)] hover:border-[color:var(--color-rec)] hover:text-[color:var(--color-rec)]",
            ].join(" ")}
          >
            {scissor ? "[ ✂ cutting ]" : "[ ✂ cut ]"}
          </button>
          <button
            type="button"
            onClick={() => handleRun()}
            className={[
              "border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition",
              running
                ? "border-[color:var(--color-rec)] bg-[color:var(--color-rec)] text-[color:var(--color-bg)] hover:opacity-90"
                : "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-bg)] hover:opacity-90",
            ].join(" ")}
          >
            {running ? "[ ■ stop ]" : "[ ▶ run flow ]"}
          </button>
          <button
            type="button"
            onClick={toggle}
            className="border border-[color:var(--color-rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
          >
            [keys]
          </button>
        </div>
      </header>

      <div
        className={[
          "relative min-h-0 flex-1",
          scissor ? "is-scissor" : "",
        ].join(" ")}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={NODE_TYPES}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: "default",
            animated: true,
            style: { stroke: "#f5f5f5", strokeWidth: 1.5 },
          }}
          connectionLineStyle={{ stroke: "#28c840", strokeWidth: 1.5 }}
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.08)" />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            maskColor="rgba(0,0,0,0.7)"
            nodeColor={() => "var(--color-ink)"}
            nodeStrokeColor="var(--color-rule)"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-rule)" }}
          />
        </ReactFlow>
      </div>

      {isOpen && <SettingsDrawer />}
    </div>
  );
}

function AddMenu({ onAdd }: { onAdd: (kind: FlowNodeKind) => void }) {
  const [open, setOpen] = useState(false);
  const items: Array<{ kind: FlowNodeKind; label: string }> = [
    { kind: "text", label: "text" },
    { kind: "prompt", label: "prompt (llm)" },
    { kind: "upload", label: "upload" },
    { kind: "imageGen", label: "image gen" },
    { kind: "edit", label: "image edit" },
    { kind: "videoGen", label: "video gen" },
    { kind: "ascii", label: "ascii" },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border border-[color:var(--color-rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
      >
        [+ add node]
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col border border-[color:var(--color-rule)] bg-[color:var(--color-bg)] py-1"
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((it) => (
            <button
              key={it.kind}
              type="button"
              onClick={() => {
                onAdd(it.kind);
                setOpen(false);
              }}
              className="px-3 py-1.5 text-left text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)] hover:bg-[color:var(--color-rule)] hover:text-[color:var(--color-fg)]"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
