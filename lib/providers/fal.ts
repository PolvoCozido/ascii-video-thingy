import { ProviderAdapter, ProviderError } from "./types";

const QUEUE_BASE = "https://queue.fal.run";

type QueueSubmit = { request_id: string; status_url: string; response_url: string };
type QueueStatus = { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" };

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

async function submit(modelId: string, apiKey: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<QueueSubmit> {
  const res = await fetch(`${QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Key ${apiKey}` },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new ProviderError(`fal submit failed: ${res.status}`, res.status, await safeJson(res));
  return (await res.json()) as QueueSubmit;
}

async function poll(url: string, apiKey: string, signal?: AbortSignal): Promise<QueueStatus> {
  const res = await fetch(url, { headers: { authorization: `Key ${apiKey}` }, signal });
  if (!res.ok) throw new ProviderError(`fal poll failed: ${res.status}`, res.status, await safeJson(res));
  return (await res.json()) as QueueStatus;
}

async function fetchResult<T>(url: string, apiKey: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Key ${apiKey}` }, signal });
  if (!res.ok) throw new ProviderError(`fal result failed: ${res.status}`, res.status, await safeJson(res));
  return (await res.json()) as T;
}

async function runJob<T>(modelId: string, apiKey: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const submitted = await submit(modelId, apiKey, input, signal);
  const started = Date.now();
  const TIMEOUT = 10 * 60 * 1000;
  while (true) {
    if (Date.now() - started > TIMEOUT) throw new ProviderError("fal job timed out", 504);
    const status = await poll(submitted.status_url, apiKey, signal);
    if (status.status === "COMPLETED") return await fetchResult<T>(submitted.response_url, apiKey, signal);
    if (status.status === "FAILED") throw new ProviderError("fal job failed", 502, status);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

type GenericOutput = {
  images?: Array<{ url: string }>;
  image?: { url: string } | string;
  video?: { url: string } | string;
  output?: string | string[];
};

function extractMedia(out: GenericOutput): { url: string; mediaType: "image" | "video" } | null {
  if (out.video) {
    const url = typeof out.video === "string" ? out.video : out.video.url;
    if (url) return { url, mediaType: "video" };
  }
  if (out.images?.[0]?.url) return { url: out.images[0].url, mediaType: "image" };
  if (out.image) {
    const url = typeof out.image === "string" ? out.image : out.image.url;
    if (url) return { url, mediaType: "image" };
  }
  if (typeof out.output === "string") {
    // Best-effort: guess by extension
    const ext = out.output.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    const mediaType = ["mp4", "webm", "mov"].includes(ext) ? "video" : "image";
    return { url: out.output, mediaType };
  }
  return null;
}

export const fal: ProviderAdapter = {
  id: "fal",
  name: "fal.ai",
  async runMedia({ modelId, payload, apiKey, signal }) {
    const out = await runJob<GenericOutput>(modelId, apiKey, payload, signal);
    const media = extractMedia(out);
    if (!media) throw new ProviderError("fal: no media in response", 502, out);
    return media;
  },
};
