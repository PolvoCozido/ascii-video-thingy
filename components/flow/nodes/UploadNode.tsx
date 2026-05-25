"use client";

import type { NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useNodeUpdate } from "@/lib/flow/useNodeUpdate";
import type { NodeData } from "@/lib/flow/types";
import { MediaPreview } from "./MediaPreview";
import { NodeShell } from "./NodeShell";

export function UploadNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as unknown as NodeData;
  const cfg = d.config as Extract<NodeData["config"], { kind: "upload" }>;
  const update = useNodeUpdate(id);
  const { setNodes } = useReactFlow();

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const mediaType: "image" | "video" = file.type.startsWith("image/") ? "image" : "video";
    update({ url, mediaType, label: file.name });
    // pre-populate output so downstream nodes can run without re-execution
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...(n.data as unknown as NodeData),
                status: "done",
                output: { media: { url, mediaType } },
                config: { kind: "upload", url, mediaType, label: file.name },
              },
            }
          : n,
      ),
    );
  };

  return (
    <NodeShell
      id={id}
      label="upload"
      status={d.status}
      selected={selected}
      inputs={[]}
      outputs={[{ name: "media", type: cfg.mediaType ?? "image" }]}
    >
      <label className="nodrag block cursor-pointer border border-dashed border-[color:var(--color-rule)] px-2 py-3 text-center text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-muted)] transition hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]">
        {cfg.label ? `↑ ${cfg.label}` : "↑ pick a file"}
        <input
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {cfg.url && cfg.mediaType && (
        <div className="mt-1.5">
          <MediaPreview media={{ url: cfg.url, mediaType: cfg.mediaType }} label={cfg.label} />
        </div>
      )}
    </NodeShell>
  );
}
