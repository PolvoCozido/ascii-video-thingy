import { ProviderAdapter, ProviderError } from "./types";

const BASE = "https://api.openai.com/v1";

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

async function fetchToBuffer(url: string): Promise<{ buffer: ArrayBuffer; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new ProviderError(`fetch image failed: ${res.status}`, res.status);
  return { buffer: await res.arrayBuffer(), type: res.headers.get("content-type") || "image/png" };
}

function dataUrlToBuffer(dataUrl: string): { buffer: ArrayBuffer; type: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new ProviderError("invalid data URL", 400);
  const type = match[1];
  const bin = atob(match[2]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return { buffer: buf.buffer, type };
}

type ImageGenResp = { data: Array<{ b64_json?: string; url?: string }> };

async function generations(payload: Record<string, unknown>, apiKey: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new ProviderError(`openai image failed: ${res.status}`, res.status, await safeJson(res));
  const data = (await res.json()) as ImageGenResp;
  const first = data.data?.[0];
  const url = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
  if (!url) throw new ProviderError("openai: no image in response", 502, data);
  return url;
}

async function edits(payload: Record<string, unknown>, apiKey: string, signal?: AbortSignal): Promise<string> {
  const imageUrl = payload.image as string | undefined;
  if (!imageUrl) throw new ProviderError("openai edit: image required", 400);
  const { buffer, type } = imageUrl.startsWith("data:") ? dataUrlToBuffer(imageUrl) : await fetchToBuffer(imageUrl);

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", String(payload.prompt ?? ""));
  if (payload.size) form.append("size", String(payload.size));
  form.append("image", new Blob([buffer], { type }), "input.png");

  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok) throw new ProviderError(`openai edit failed: ${res.status}`, res.status, await safeJson(res));
  const data = (await res.json()) as ImageGenResp;
  const first = data.data?.[0];
  const url = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
  if (!url) throw new ProviderError("openai: no image in edit response", 502, data);
  return url;
}

export const openai: ProviderAdapter = {
  id: "openai",
  name: "OpenAI",
  async runMedia({ modelId, payload, apiKey, signal }) {
    const url =
      modelId === "gpt-image-1:edit"
        ? await edits(payload, apiKey, signal)
        : await generations({ ...payload, model: "gpt-image-1" }, apiKey, signal);
    return { url, mediaType: "image" };
  },
  async runChat({ payload, apiKey, signal }) {
    // payload was built by the chat ModelSpec — already has model, messages, temperature, max_tokens
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new ProviderError(`openai chat failed: ${res.status}`, res.status, await safeJson(res));
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError("openai: empty chat response", 502, data);
    return text;
  },
};
