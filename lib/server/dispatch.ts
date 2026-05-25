import { NextResponse } from "next/server";
import { getProvider, type ProviderError } from "@/lib/providers";

const ALLOWED_PROVIDERS = new Set(["fal", "replicate", "openai", "xai", "kling"]);

type MediaBody = { provider?: string; modelId?: string; payload?: Record<string, unknown> };

export async function dispatchMedia(req: Request): Promise<Response> {
  const apiKey = req.headers.get("x-provider-key");
  if (!apiKey) return NextResponse.json({ error: "missing x-provider-key header" }, { status: 400 });

  let body: MediaBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const { provider, modelId, payload } = body;
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "unknown or missing provider" }, { status: 400 });
  }
  if (!modelId || !payload || typeof payload !== "object") {
    return NextResponse.json({ error: "modelId and payload required" }, { status: 400 });
  }

  const adapter = getProvider(provider);
  if (!adapter.runMedia) {
    return NextResponse.json({ error: `${adapter.name} has no runMedia` }, { status: 400 });
  }

  try {
    const result = await adapter.runMedia({ modelId, payload, apiKey, signal: req.signal });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as ProviderError;
    const status = typeof e.status === "number" ? e.status : 500;
    return NextResponse.json(
      { error: e.message || "provider error", body: e.body ?? null },
      { status },
    );
  }
}

export async function dispatchChat(req: Request): Promise<Response> {
  const apiKey = req.headers.get("x-provider-key");
  if (!apiKey) return NextResponse.json({ error: "missing x-provider-key header" }, { status: 400 });

  let body: MediaBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const { provider, modelId, payload } = body;
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "unknown or missing provider" }, { status: 400 });
  }
  if (!modelId || !payload || typeof payload !== "object") {
    return NextResponse.json({ error: "modelId and payload required" }, { status: 400 });
  }

  const adapter = getProvider(provider);
  if (!adapter.runChat) {
    return NextResponse.json({ error: `${adapter.name} has no runChat` }, { status: 400 });
  }

  try {
    const text = await adapter.runChat({ modelId, payload, apiKey, signal: req.signal });
    return NextResponse.json({ text });
  } catch (err) {
    const e = err as ProviderError;
    const status = typeof e.status === "number" ? e.status : 500;
    return NextResponse.json(
      { error: e.message || "provider error", body: e.body ?? null },
      { status },
    );
  }
}
