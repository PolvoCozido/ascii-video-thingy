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

  const upstream = await fetch(parsed.toString(), { signal: req.signal });
  if (!upstream.ok || !upstream.body) {
    return new Response(`upstream ${upstream.status}`, { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("content-length", contentLength);
  headers.set("cache-control", "private, max-age=300");
  // Same-origin response — no CORS needed for our own canvas.
  headers.set("access-control-allow-origin", "*");

  return new Response(upstream.body, { status: 200, headers });
}
