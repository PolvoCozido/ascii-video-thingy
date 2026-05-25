import { ProviderAdapter, ProviderError } from "./types";

const BASE = "https://api.x.ai/v1";

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

type ImageGenResp = { data: Array<{ b64_json?: string; url?: string }> };

export const xai: ProviderAdapter = {
  id: "xai",
  name: "xAI",
  async runMedia({ payload, apiKey, signal }) {
    // OpenAI-compatible image generations endpoint.
    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new ProviderError(`xai image failed: ${res.status}`, res.status, await safeJson(res));
    const data = (await res.json()) as ImageGenResp;
    const first = data.data?.[0];
    const url = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
    if (!url) throw new ProviderError("xai: no image in response", 502, data);
    return { url, mediaType: "image" };
  },
  async runChat({ payload, apiKey, signal }) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new ProviderError(`xai chat failed: ${res.status}`, res.status, await safeJson(res));
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new ProviderError("xai: empty chat response", 502, data);
    return text;
  },
};
