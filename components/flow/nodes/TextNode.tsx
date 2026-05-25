"use client";

import type { NodeProps } from "@xyflow/react";
import { useNodeUpdate } from "@/lib/flow/useNodeUpdate";
import type { NodeData } from "@/lib/flow/types";
import { copyText } from "@/lib/clipboard";
import { CopyButton } from "./CopyButton";
import { NodeShell } from "./NodeShell";

const OUTPUTS = [{ name: "text", type: "text" as const }];

export function TextNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as unknown as NodeData;
  const cfg = d.config as Extract<NodeData["config"], { kind: "text" }>;
  const update = useNodeUpdate(id);

  return (
    <NodeShell id={id} label="text" status={d.status} selected={selected} inputs={[]} outputs={OUTPUTS}>
      <textarea
        value={cfg.text}
        onChange={(e) => update({ text: e.target.value })}
        placeholder="your idea…"
        rows={3}
        className="nodrag w-full resize-none border border-[color:var(--color-rule)] bg-transparent p-2 text-[11px] leading-snug text-[color:var(--color-fg)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-ink)] focus:outline-none"
      />
      <div className="mt-1 flex justify-end text-[9px] uppercase tracking-[0.16em]">
        <CopyButton disabled={!cfg.text} onCopy={() => copyText(cfg.text)} />
      </div>
    </NodeShell>
  );
}
