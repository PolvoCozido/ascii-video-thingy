export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  // fal
  "fal.media",
  "v3.fal.media",
  "v2.fal.media",
  "queue.fal.run",
  // replicate
  "replicate.delivery",
  "pbxt.replicate.delivery",
  "tjzk.replicate.delivery",
  // openai
  "oaidalleapiprodscus.blob.core.windows.net",
  "files.openai.com",
  // xai (grok image) — imgen.x.ai
  "x.ai",
  // kling (kuaishou) — rotating regional CDN hosts, e.g. v16-kling-fdl.klingai.com
  "klingai.com",
  "kuaishou.com",
]);

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return new Response("only https allowed", { status: 400 });
  }
  const host = parsed.hostname;
  if (!ALLOWED_HOSTS.has(host) && !Array.from(ALLOWED_HOSTS).some((h) => host.endsWith(`.${h}`))) {
    return new Response("host not allowed", { status: 403 });
  }

  // Forward the Range header so <video> can stream/seek. Video elements
  // (Safari especially) require 206 Partial Content support or they refuse
  // to play with "No video with supported format and MIME type found".
  const range = req.headers.get("range");
  const upstream = await fetch(parsed.toString(), {
    signal: req.signal,
    headers: range ? { range } : undefined,
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, { status: upstream.status });
  }

  const headers = new Headers();
  // Pass through the headers a media element needs for streaming/seeking.
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=300");
  // Same-origin response — no CORS needed for our own canvas.
  headers.set("access-control-allow-origin", "*");

  // Mirror upstream status: 206 when a range was served, 200 otherwise.
  return new Response(upstream.body, { status: upstream.status, headers });
}
