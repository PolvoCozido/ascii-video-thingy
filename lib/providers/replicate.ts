import { ProviderAdapter, ProviderError } from "./types";

const BASE = "https://api.replicate.com/v1";

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
  urls?: { get?: string };
};

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

async function createPrediction(modelRef: string, apiKey: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<Prediction> {
  let endpoint: string;
  let body: Record<string, unknown>;
  if (modelRef.includes(":")) {
    endpoint = `${BASE}/predictions`;
    const [, version] = modelRef.split(":");
    body = { version, input };
  } else {
    endpoint = `${BASE}/models/${modelRef}/predictions`;
    body = { input };
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      prefer: "wait=30",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok && res.status !== 201) {
    throw new ProviderError(`replicate create failed: ${res.status}`, res.status, await safeJson(res));
  }
  return (await res.json()) as Prediction;
}

async function pollPrediction(url: string, apiKey: string, signal?: AbortSignal): Promise<Prediction> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal });
  if (!res.ok) throw new ProviderError(`replicate poll failed: ${res.status}`, res.status, await safeJson(res));
  return (await res.json()) as Prediction;
}

async function runPrediction(modelRef: string, apiKey: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  let p = await createPrediction(modelRef, apiKey, input, signal);
  const started = Date.now();
  const TIMEOUT = 10 * 60 * 1000;
  while (p.status !== "succeeded" && p.status !== "failed" && p.status !== "canceled") {
    if (Date.now() - started > TIMEOUT) throw new ProviderError("replicate prediction timed out", 504);
    if (!p.urls?.get) throw new ProviderError("replicate: missing poll url", 502, p);
    await new Promise((r) => setTimeout(r, 2000));
    p = await pollPrediction(p.urls.get, apiKey, signal);
  }
  if (p.status !== "succeeded") throw new ProviderError(p.error || `replicate prediction ${p.status}`, 502, p);
  return p.output;
}

function firstUrlFromOutput(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const v = output.find((x) => typeof x === "string");
    return typeof v === "string" ? v : null;
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    for (const key of ["url", "video", "image", "output"]) {
      const v = o[key];
      if (typeof v === "string") return v;
      if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    }
  }
  return null;
}

export const replicate: ProviderAdapter = {
  id: "replicate",
  name: "Replicate",
  async runMedia({ modelId, payload, apiKey, signal }) {
    const out = await runPrediction(modelId, apiKey, payload, signal);
    const url = firstUrlFromOutput(out);
    if (!url) throw new ProviderError("replicate: no media url in output", 502, out);
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    const mediaType: "image" | "video" = ["mp4", "webm", "mov"].includes(ext) ? "video" : "image";
    return { url, mediaType };
  },
};
