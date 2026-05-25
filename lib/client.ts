"use client";

import type { GenerationResult, ProviderId } from "@/lib/providers/types";

export function proxify(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Walk a payload object and convert any blob: URLs to data: URLs (server can't fetch blob:).
async function preparePayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...payload };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string" && v.startsWith("blob:")) {
      out[k] = await blobUrlToDataUrl(v);
    }
  }
  return out;
}

export async function callMedia(args: {
  provider: ProviderId;
  modelId: string;
  payload: Record<string, unknown>;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<GenerationResult> {
  const { provider, modelId, apiKey, signal } = args;
  const payload = await preparePayload(args.payload);
  const res = await fetch("/api/media", {
    method: "POST",
    headers: { "content-type": "application/json", "x-provider-key": apiKey },
    body: JSON.stringify({ provider, modelId, payload }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const result = (await res.json()) as GenerationResult;
  return { ...result, url: proxify(result.url) };
}

export async function callChat(args: {
  provider: ProviderId;
  modelId: string;
  payload: Record<string, unknown>;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { provider, modelId, apiKey, signal } = args;
  const payload = await preparePayload(args.payload);
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-provider-key": apiKey },
    body: JSON.stringify({ provider, modelId, payload }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { text: string };
  return data.text;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body?.error || `request failed (${res.status})`;
  } catch {
    return `request failed (${res.status})`;
  }
}
