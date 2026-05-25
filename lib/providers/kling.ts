import crypto from "node:crypto";
import { ProviderAdapter, ProviderError } from "./types";

// If your Kling account is on a different region, edit this base.
// Known hosts:
//   - https://api.klingai.com           (default — works for most accounts)
//   - https://api-singapore.klingai.com (global / singapore region)
//   - https://api-beijing.klingai.com   (beijing region)
const BASE = "https://api.klingai.com";

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

/**
 * Kling auth: a JWT (HS256) signed with the user's access_key + secret_key.
 * The user pastes them colon-separated in the settings drawer:  AK:SK
 * We sign a short-lived JWT per request — Kling's tokens are typically 30min,
 * but we mint fresh ones so expiry never bites.
 */
function signKlingJwt(apiKey: string): string {
  const idx = apiKey.indexOf(":");
  if (idx < 0) {
    throw new ProviderError(
      "kling key must be 'access_key:secret_key' (paste both, colon-separated)",
      400,
    );
  }
  const accessKey = apiKey.slice(0, idx).trim();
  const secretKey = apiKey.slice(idx + 1).trim();
  if (!accessKey || !secretKey) {
    throw new ProviderError("kling key missing access_key or secret_key", 400);
  }
  const enc = (o: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ iss: accessKey, exp: now + 1800, nbf: now - 5 });
  const sig = crypto.createHmac("sha256", secretKey).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/**
 * Kling accepts either an https URL or base64 image data (without the data: prefix).
 * Strip the data URL prefix so the API accepts it.
 */
function normalizeImage(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  if (input.startsWith("data:")) {
    const idx = input.indexOf(",");
    return idx >= 0 ? input.slice(idx + 1) : input;
  }
  return input;
}

type KlingResp<T = unknown> = {
  code: number;
  message: string;
  data?: T;
};

type Task = {
  task_id: string;
  task_status: "submitted" | "processing" | "succeed" | "failed";
  task_status_msg?: string;
  task_result?: {
    videos?: Array<{ id: string; url: string; duration: string }>;
  };
};

async function submit(
  endpoint: string,
  jwt: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const j = (await safeJson(res)) as KlingResp<Task> | null;
  if (!res.ok || !j || j.code !== 0 || !j.data?.task_id) {
    throw new ProviderError(
      `kling submit failed: ${res.status} ${j?.message ?? ""}`.trim(),
      res.status,
      j,
    );
  }
  return j.data.task_id;
}

async function poll(endpoint: string, taskId: string, jwt: string, signal?: AbortSignal): Promise<Task> {
  const res = await fetch(`${BASE}${endpoint}/${taskId}`, {
    headers: { authorization: `Bearer ${jwt}` },
    signal,
  });
  const j = (await safeJson(res)) as KlingResp<Task> | null;
  if (!res.ok || !j || j.code !== 0 || !j.data) {
    throw new ProviderError(`kling poll failed: ${res.status} ${j?.message ?? ""}`.trim(), res.status, j);
  }
  return j.data;
}

async function waitForVideo(endpoint: string, taskId: string, jwt: string, signal?: AbortSignal): Promise<string> {
  const started = Date.now();
  const TIMEOUT = 15 * 60 * 1000;
  while (true) {
    if (Date.now() - started > TIMEOUT) throw new ProviderError("kling task timed out", 504);
    const task = await poll(endpoint, taskId, jwt, signal);
    if (task.task_status === "succeed") {
      const url = task.task_result?.videos?.[0]?.url;
      if (!url) throw new ProviderError("kling: no video url in result", 502, task);
      return url;
    }
    if (task.task_status === "failed") {
      throw new ProviderError(task.task_status_msg || "kling task failed", 502, task);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export const kling: ProviderAdapter = {
  id: "kling",
  name: "Kling",
  async runMedia({ modelId, payload, apiKey, signal }) {
    const jwt = signKlingJwt(apiKey);

    // Spec.buildPayload tags which endpoint to hit via a private __endpoint key.
    const endpoint = (payload.__endpoint as string) ?? "/v1/videos/image2video";
    const body: Record<string, unknown> = { ...payload };
    delete body.__endpoint;

    // Image fields need data URL prefix stripped if present.
    if (typeof body.image === "string") body.image = normalizeImage(body.image);
    if (typeof body.image_tail === "string") body.image_tail = normalizeImage(body.image_tail);

    // Model name in body; fold modelId in so the spec doesn't have to.
    if (!body.model_name) body.model_name = modelId;

    const taskId = await submit(endpoint, jwt, body, signal);
    const url = await waitForVideo(endpoint, taskId, jwt, signal);
    return { url, mediaType: "video" };
  },
};
