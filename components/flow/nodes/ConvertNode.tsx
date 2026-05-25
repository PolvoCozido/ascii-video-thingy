"use client";

import type { NodeProps } from "@xyflow/react";
import type { NodeData } from "@/lib/flow/types";
import { MediaPreview } from "./MediaPreview";
import { NodeShell } from "./NodeShell";

export function ConvertNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as unknown as NodeData;
  const media = d.output?.media;

  const handleDownload = () => {
    if (!media) return;
    const a = document.createElement("a");
    a.href = media.url;
    a.download = `converted-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <NodeShell
      id={id}
      label="webm → mp4"
      status={d.status}
      selected={selected}
      width={240}
      inputs={[{ name: "media", type: "video" }]}
      outputs={[{ name: "media", type: "video" }]}
    >
      <div className="flex flex-col gap-1.5">
        {d.status === "running" && (
          <div className="border border-dashed border-[color:var(--color-rule)] px-2 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
            converting · first run loads ~30mb wasm
          </div>
        )}
        {d.status === "error" && d.error && (
          <div className="border border-[color:var(--color-rec)] px-2 py-1.5 text-[9px] text-[color:var(--color-rec)]">
            {d.error}
          </div>
        )}
        {media ? (
          <>
            <MediaPreview media={media} label="mp4" pixelated />
            <div className="flex justify-end text-[9px] uppercase tracking-[0.16em]">
              <button
                type="button"
                onClick={handleDownload}
                className="nodrag text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              >
                [↓ save mp4]
              </button>
            </div>
          </>
        ) : (
          d.status !== "running" && (
            <div className="border border-dashed border-[color:var(--color-rule)] px-2 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
              connect a video, then run
            </div>
          )
        )}
      </div>
    </NodeShell>
  );
}
