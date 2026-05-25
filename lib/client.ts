"use client";

import type { GenerationResult, ProviderId } from "@/lib/providers/types";

export function proxify(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/")) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

/** Fetch any URL the browser can reach and return it as a base64 data: URL. */
export async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load media input (${res.status})`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const blobUrlToDataUrl = fetchAsDataUrl;

/**
 * Resolve media inputs to base64 data: URLs before sending to the server.
 * Upstream image/video outputs are stored as proxied, *relative* URLs
 * (`/api/proxy?url=…`) for in-app display — but external providers (Kling, fal
 * img2img, …) can't fetch a relative URL, so they must receive the bytes inline.
 * The browser can read our own proxy same-origin, so we convert here.
 */
async function preparePayload(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...payload };
  for (const k of Object.keys(out)) {
    if (k.startsWith("__")) continue; // private control fields (e.g. __endpoint)
    const v = out[k];
    if (typeof v !== "string") continue;
    if (v.startsWith("data:")) continue; // already inline
    if (v.startsWith("blob:") || v.startsWith("/")) {
      // blob: (local upload) or relative proxy/static URL — fetch same-origin.
      out[k] = await fetchAsDataUrl(v);
    } else if (v.startsWith("http://") || v.startsWith("https://")) {
      // absolute remote URL — route through the proxy to dodge CORS.
      out[k] = await fetchAsDataUrl(proxify(v));
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
