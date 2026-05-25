"use client";

import type { NodeProps } from "@xyflow/react";
import { useNodeConnections, useNodesData } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FRAG_SRC, VERT_SRC, getUniformLocs, linkProgram, setStyleUniforms } from "@/lib/shader";
import { downloadAsciiImage, recordAsciiVideoLoop, renderAsciiSnapshotBlob, triggerDownload, type VideoRecordController } from "@/lib/ascii/export";
import { STYLE_DEFAULTS, type StyleState } from "@/lib/style";
import { copyImageBlob } from "@/lib/clipboard";
import { useNodeUpdate } from "@/lib/flow/useNodeUpdate";
import type { NodeData } from "@/lib/flow/types";
import { CopyButton } from "./CopyButton";
import { NodeShell } from "./NodeShell";

export function AsciiNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as unknown as NodeData;
  const cfg = d.config as Extract<NodeData["config"], { kind: "ascii" }>;
  const update = useNodeUpdate(id);
  const [expanded, setExpanded] = useState(false);

  // Live preview reads the upstream source (so the shader can re-render
  // continuously with current style settings). The node's own output is the
  // one-shot rendered result that downstream nodes (e.g. convert) consume.
  const incoming = useNodeConnections({ id, handleType: "target", handleId: "media" });
  const upstreamId = incoming[0]?.source;
  const upstreamNode = useNodesData(upstreamId ?? "");
  const upstreamMedia = (upstreamNode?.data as unknown as NodeData | undefined)?.output?.media;
  const sourceUrl = upstreamMedia?.url;
  const sourceType = upstreamMedia?.mediaType;
  const download = useAsciiDownload(sourceUrl, sourceType ?? "image", cfg.style);

  return (
    <>
      <NodeShell
        id={id}
        label="ascii"
        status={d.status}
        selected={selected}
        width={260}
        inputs={[{ name: "media", type: "image" }]}
        outputs={[{ name: "media", type: "video" }]}
      >
        <div className="flex flex-col gap-1.5">
          <div className="relative aspect-video w-full overflow-hidden border border-[color:var(--color-rule)] bg-black">
            {sourceUrl ? (
              <MiniAsciiCanvas key={sourceUrl} style={cfg.style} url={sourceUrl} mediaType={sourceType ?? "image"} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
                no input
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
            <span className="whitespace-nowrap">px {cfg.style.pixel} · gm {cfg.style.gamma.toFixed(1)}</span>
            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
              <CopyButton
                idleLabel="[⎘]"
                disabled={!sourceUrl}
                onCopy={async () => {
                  const blob = await renderAsciiSnapshotBlob(sourceUrl!, sourceType ?? "image", cfg.style);
                  await copyImageBlob(blob);
                }}
              />
              <SaveButton state={download} />
              <button
                type="button"
                onClick={() => setExpanded(true)}
                disabled={!sourceUrl}
                className="nodrag whitespace-nowrap text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] disabled:opacity-40"
              >
                [expand]
              </button>
            </div>
          </div>
          <StyleMini style={cfg.style} onChange={(p) => update({ style: { ...cfg.style, ...p } })} />
        </div>
      </NodeShell>

      {expanded && sourceUrl && (
        <FullscreenAscii
          style={cfg.style}
          url={sourceUrl}
          mediaType={sourceType ?? "image"}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

/**
 * Drives downloading the ASCII output: a PNG for images, a recorded one-loop
 * clip for videos. Both render off-screen at the source's native resolution.
 */
function useAsciiDownload(url: string | undefined, mediaType: "image" | "video", style: StyleState) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const ctrlRef = useRef<VideoRecordController | null>(null);
  const styleRef = useRef(style);
  styleRef.current = style;

  const trigger = useCallback(() => {
    if (!url) return;
    if (recording) {
      ctrlRef.current?.stop();
      return;
    }
    if (mediaType === "image") {
      setBusy(true);
      downloadAsciiImage(url, styleRef.current)
        .catch((err) => console.error("png export failed", err))
        .finally(() => setBusy(false));
      return;
    }
    setRecording(true);
    setElapsed(0);
    const ctrl = recordAsciiVideoLoop(url, styleRef.current, setElapsed);
    ctrlRef.current = ctrl;
    ctrl.done
      .then((blob) => {
        const ext = blob.type.startsWith("video/mp4") ? "mp4" : "webm";
        triggerDownload(blob, `ascii-${Date.now()}.${ext}`);
      })
      .catch((err) => console.error("video export failed", err))
      .finally(() => {
        setRecording(false);
        ctrlRef.current = null;
      });
  }, [url, mediaType, recording]);

  return { recording, elapsed, busy, trigger, disabled: !url };
}

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const x = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}

function SaveButton({
  state,
  className,
}: {
  state: ReturnType<typeof useAsciiDownload>;
  className?: string;
}) {
  const { recording, elapsed, busy, trigger, disabled } = state;
  const label = recording
    ? `[ ■ rec ${fmtElapsed(elapsed)} ]`
    : busy
      ? "[ … ]"
      : "[ ↓ save ]";
  return (
    <button
      type="button"
      onClick={trigger}
      disabled={disabled || busy}
      title={recording ? "stop & download" : "download ascii output"}
      className={[
        "nodrag transition disabled:opacity-40",
        recording
          ? "text-[color:var(--color-rec)]"
          : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]",
        className ?? "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StyleMini({ style, onChange }: { style: StyleState; onChange: (p: Partial<StyleState>) => void }) {
  return (
    <div className="nodrag mt-1 flex flex-col gap-1 border-t border-[color:var(--color-rule)] pt-1.5">
      <MiniSlider label="pixel"   value={style.pixel}   min={1}   max={10}  step={1}    digits={0} onChange={(v) => onChange({ pixel: v })} />
      <MiniSlider label="black"   value={style.black}   min={0}   max={0.7} step={0.01} digits={2} onChange={(v) => onChange({ black: v })} />
      <MiniSlider label="white"   value={style.white}   min={0.2} max={1.5} step={0.01} digits={2} onChange={(v) => onChange({ white: v })} />
      <MiniSlider label="density" value={style.density} min={0.1} max={1.0} step={0.01} digits={2} onChange={(v) => onChange({ density: v })} />
      <MiniSlider label="gamma"   value={style.gamma}   min={0.3} max={2.5} step={0.05} digits={2} onChange={(v) => onChange({ gamma: v })} />
      <MiniSlider label="shimmer" value={style.shimmer} min={0}   max={2}   step={0.05} digits={2} onChange={(v) => onChange({ shimmer: v })} />
      <MiniSlider label="drift"   value={style.drift}   min={0}   max={3}   step={0.05} digits={2} onChange={(v) => onChange({ drift: v })} />
      <div className="flex items-center gap-2 pt-0.5 text-[9px] uppercase tracking-[0.14em]">
        <span className="w-14 flex-shrink-0 text-[color:var(--color-muted)]">ink/bg</span>
        <input
          type="color"
          value={style.ink}
          onChange={(e) => onChange({ ink: e.target.value })}
          className="h-5 w-6 cursor-pointer border border-[color:var(--color-rule)] bg-transparent p-0"
        />
        <input
          type="color"
          value={style.bg}
          onChange={(e) => onChange({ bg: e.target.value })}
          className="h-5 w-6 cursor-pointer border border-[color:var(--color-rule)] bg-transparent p-0"
        />
        <button
          type="button"
          onClick={() => onChange({ ...STYLE_DEFAULTS })}
          className="ml-auto text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
        >
          [reset]
        </button>
      </div>
    </div>
  );
}

function MiniSlider({
  label, value, min, max, step, digits, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; digits: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
      <span className="w-14 flex-shrink-0 text-[color:var(--color-muted)]">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="min-w-0 flex-1 accent-[color:var(--color-ink)]"
      />
      <span className="w-9 flex-shrink-0 text-right tabular-nums text-[color:var(--color-fg)]">{value.toFixed(digits)}</span>
    </label>
  );
}

function FullscreenAscii({
  style, url, mediaType, onClose,
}: {
  style: StyleState; url: string; mediaType: "image" | "video"; onClose: () => void;
}) {
  const download = useAsciiDownload(url, mediaType, style);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between border-b border-[color:var(--color-rule)] px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          ascii · fullscreen
        </span>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.18em]">
          <SaveButton state={download} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            [close esc]
          </button>
        </div>
      </div>
      <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
        <MiniAsciiCanvas key={url} style={style} url={url} mediaType={mediaType} />
      </div>
    </div>
  );
}

function MiniAsciiCanvas({
  style, url, mediaType,
}: {
  style: StyleState; url: string; mediaType: "image" | "video";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgPendingRef = useRef(false);
  const styleRef = useRef(style);
  styleRef.current = style;

  useEffect(() => {
    if (mediaType === "video") {
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.crossOrigin = "anonymous";
      v.src = url;
      videoRef.current = v;
      v.play().catch(() => {});
      return () => {
        v.pause();
        videoRef.current = null;
      };
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imgRef.current = img;
        imgPendingRef.current = true;
      };
      img.onerror = () => console.error("image load failed", url);
      img.src = url;
      return () => {
        imgRef.current = null;
      };
    }
  }, [url, mediaType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return;

    const prog = linkProgram(gl, VERT_SRC, FRAG_SRC);
    gl.useProgram(prog);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const u = getUniformLocs(gl, prog);
    gl.uniform1i(u.tex, 0);

    // Render at the SOURCE's native resolution (matching the exporter) so the
    // dither pattern, gamma, etc. are pixel-identical to the downloaded file.
    // The canvas is then CSS-scaled to fit its container via object-contain.
    let lastW = 0;
    let lastH = 0;
    const ensureSize = (w: number, h: number) => {
      if (w === lastW && h === lastH) return;
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      gl.viewport(0, 0, canvas.width, canvas.height);
      lastW = w;
      lastH = h;
    };

    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const s = styleRef.current;
      let srcW = 720, srcH = 900;
      const v = videoRef.current;
      const i = imgRef.current;
      if (v && v.readyState >= 2) {
        srcW = v.videoWidth || srcW; srcH = v.videoHeight || srcH;
        ensureSize(srcW, srcH);
        try {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
        } catch (err) { console.error("video upload failed", err); }
      } else if (i) {
        srcW = i.naturalWidth || srcW; srcH = i.naturalHeight || srcH;
        ensureSize(srcW, srcH);
        if (imgPendingRef.current) {
          try {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, i);
            imgPendingRef.current = false;
          } catch (err) {
            console.error("image upload failed", err);
            imgPendingRef.current = false;
          }
        }
      }

      // pixelScale = 1 to match the exporter — see lib/ascii/export.ts.
      setStyleUniforms(gl, u, s, canvas.width, canvas.height, srcW, srcH, t, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteTexture(tex);
      gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full object-contain" />;
}
