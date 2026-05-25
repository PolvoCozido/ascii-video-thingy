"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Single-threaded core — avoids COOP/COEP cross-origin isolation headers,
// which would otherwise break loading external media through our /api/proxy.
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function load(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loading) return loading;
  loading = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    instance = ff;
    return ff;
  })();
  return loading;
}

export type ConvertProgress = { ratio: number };

export async function convertToMp4(
  inputUrl: string,
  onProgress?: (p: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<string> {
  const ff = await load();
  if (signal?.aborted) throw new Error("aborted");

  const onProg = ({ progress }: { progress: number }) =>
    onProgress?.({ ratio: Math.max(0, Math.min(1, progress)) });
  ff.on("progress", onProg);

  const onAbort = () => {
    try {
      ff.terminate();
    } catch {
      // ignore
    }
    // Clear singleton — terminated instance is unusable for next run.
    instance = null;
    loading = null;
  };
  signal?.addEventListener("abort", onAbort);

  try {
    await ff.writeFile("in", await fetchFile(inputUrl));
    // High-contrast/saturated ASCII content suffers badly from default chroma
    // subsampling + fast presets — colors mute and edges bleed. `-crf 18` is
    // visually lossless and `-preset slow` gives the encoder time to preserve
    // the punchy contrast we record at 12 Mbps webm.
    await ff.exec([
      "-i", "in",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
      "out.mp4",
    ]);
    const data = (await ff.readFile("out.mp4")) as Uint8Array;
    // Single-threaded core returns a Uint8Array<ArrayBuffer>; the TS type widens
    // to ArrayBufferLike to cover the SAB case which we don't use.
    const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
    return URL.createObjectURL(blob);
  } finally {
    ff.off("progress", onProg);
    signal?.removeEventListener("abort", onAbort);
    try {
      await ff.deleteFile("in");
    } catch {
      // ignore
    }
    try {
      await ff.deleteFile("out.mp4");
    } catch {
      // ignore
    }
  }
}
