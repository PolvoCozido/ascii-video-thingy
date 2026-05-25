import {
  FRAG_SRC,
  VERT_SRC,
  getUniformLocs,
  linkProgram,
  setStyleUniforms,
} from "@/lib/shader";
import type { StyleState } from "@/lib/style";

/**
 * Renders the ASCII shader off-screen at the *source's native resolution* and
 * captures it — a PNG for stills, a recorded one-loop video for clips. This is
 * deliberately independent of the on-canvas preview (which is sized to the node)
 * so exports come out full-size regardless of how small the preview is.
 */

type GLBundle = {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  tex: WebGLTexture;
  u: ReturnType<typeof getUniformLocs>;
  dispose: () => void;
};

function setupGL(canvas: HTMLCanvasElement): GLBundle {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL unavailable");

  const prog = linkProgram(gl, VERT_SRC, FRAG_SRC);
  gl.useProgram(prog);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const u = getUniformLocs(gl, prog);
  gl.uniform1i(u.tex, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);

  return {
    gl,
    prog,
    tex,
    u,
    dispose: () => {
      gl.deleteTexture(tex);
      gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
    },
  };
}

function uploadFrame(
  bundle: GLBundle,
  source: TexImageSource,
) {
  const { gl, tex } = bundle;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = url;
  });
}

function loadVideoFrame(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.src = url;
    // loadeddata guarantees the first frame is decoded and uploadable.
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("video failed to load"));
  });
}

/** Render a single shader frame of the given source at native resolution. */
function renderSourceToBlob(
  source: TexImageSource,
  w: number,
  h: number,
  style: StyleState,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const bundle = setupGL(canvas);
  try {
    uploadFrame(bundle, source);
    setStyleUniforms(bundle.gl, bundle.u, style, w, h, w, h, 0, 1);
    bundle.gl.drawArrays(bundle.gl.TRIANGLES, 0, 6);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/png"),
    );
  } finally {
    bundle.dispose();
  }
}

/**
 * Render one ASCII frame (still image, or the first frame of a video) and
 * return it as a PNG blob — used for both downloading and clipboard copy.
 */
export async function renderAsciiSnapshotBlob(
  url: string,
  mediaType: "image" | "video",
  style: StyleState,
): Promise<Blob> {
  if (mediaType === "video") {
    const v = await loadVideoFrame(url);
    return renderSourceToBlob(v, v.videoWidth || 1280, v.videoHeight || 720, style);
  }
  const img = await loadImage(url);
  return renderSourceToBlob(img, img.naturalWidth || 1024, img.naturalHeight || 1024, style);
}

/** Render one shader frame of a still image and download it as a PNG. */
export async function downloadAsciiImage(url: string, style: StyleState): Promise<void> {
  const blob = await renderAsciiSnapshotBlob(url, "image", style);
  triggerDownload(blob, `ascii-${Date.now()}.png`);
}

function pickMime(): string {
  const cands = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return (
    cands.find(
      (t) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    ) ?? ""
  );
}

export type VideoRecordController = {
  /** Resolves when the file has been recorded and the download triggered. */
  done: Promise<void>;
  /** Stop early (otherwise auto-stops after one loop). */
  stop: () => void;
};

/**
 * Record exactly one loop of a video through the shader and download it.
 * `onTick` reports elapsed seconds so the UI can show a REC timer.
 */
export function recordAsciiVideoLoop(
  url: string,
  style: StyleState,
  onTick?: (elapsed: number) => void,
): VideoRecordController {
  if (typeof MediaRecorder === "undefined") {
    return {
      done: Promise.reject(new Error("MediaRecorder not supported")),
      stop: () => {},
    };
  }

  let stopFn = () => {};
  const done = new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    let raf = 0;
    let autoStop: ReturnType<typeof setTimeout> | undefined;
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let bundle: GLBundle | null = null;
    let recorder: MediaRecorder | null = null;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      if (autoStop) clearTimeout(autoStop);
      if (tickTimer) clearInterval(tickTimer);
      video.pause();
      bundle?.dispose();
    };

    const start = async () => {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      bundle = setupGL(canvas);

      const stream = canvas.captureStream(60);
      const mime = pickMime();
      try {
        recorder = new MediaRecorder(
          stream,
          mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000 } : {},
        );
      } catch (err) {
        cleanup();
        reject(err as Error);
        return;
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        cleanup();
        const recMime = recorder!.mimeType || "video/webm";
        const isMp4 = recMime.startsWith("video/mp4");
        const blob = new Blob(chunks, {
          type: isMp4 ? "video/mp4" : "video/webm",
        });
        triggerDownload(blob, `ascii-${Date.now()}.${isMp4 ? "mp4" : "webm"}`);
        resolve();
      };

      stopFn = () => {
        if (recorder && recorder.state === "recording") recorder.stop();
      };

      const dur =
        isFinite(video.duration) && video.duration > 0 ? video.duration : 6;

      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      await video.play().catch(() => {});

      const t0 = performance.now();
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        const b = bundle!;
        if (video.readyState >= 2) {
          uploadFrame(b, video);
          setStyleUniforms(b.gl, b.u, style, w, h, w, h, t, 1);
          b.gl.drawArrays(b.gl.TRIANGLES, 0, 6);
        }
        raf = requestAnimationFrame(loop);
      };

      recorder.start(100);
      raf = requestAnimationFrame(loop);
      if (onTick) {
        onTick(0);
        tickTimer = setInterval(
          () => onTick((performance.now() - t0) / 1000),
          250,
        );
      }
      autoStop = setTimeout(() => stopFn(), (dur + 0.1) * 1000);
    };

    video.onloadedmetadata = () => void start();
    video.onerror = () => reject(new Error("video failed to load"));
  });

  return { done, stop: () => stopFn() };
}
