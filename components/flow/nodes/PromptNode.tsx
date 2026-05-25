"use client";

import type { NodeProps } from "@xyflow/react";
import { useState } from "react";
import { useNodeUpdate } from "@/lib/flow/useNodeUpdate";
import { useModelChange } from "@/lib/flow/useModelChange";
import type { NodeData } from "@/lib/flow/types";
import { getSpec, specsForKind } from "@/lib/models/registry";
import type { ProviderId } from "@/lib/providers/types";
import { copyText } from "@/lib/clipboard";
import { ConfigFields } from "./ConfigFields";
import { CopyButton } from "./CopyButton";
import { NodeShell, type ShellPort } from "./NodeShell";
import { Working } from "./Working";

export function PromptNode(props: NodeProps) {
  const { id, data, selected } = props;
  const d = data as unknown as NodeData;
  const cfg = d.config as Extract<NodeData["config"], { kind: "prompt" }>;
  const updateConfig = useNodeUpdate(id);
  const onModelChange = useModelChange(id);
  const [contextOpen, setContextOpen] = useState(false);

  const spec = getSpec(cfg.provider, cfg.model);
  const catalog = specsForKind("prompt");

  const inputs: ShellPort[] = spec ? spec.inputs.map((i) => ({ name: i.name, label: i.label, type: i.type })) : [];
  const outputs: ShellPort[] = [{ name: "text", type: "text" }];

  return (
    <NodeShell
      id={id}
      label="prompt"
      status={d.status}
      selected={selected}
      inputs={inputs}
      outputs={outputs}
      width={280}
    >
      <div className="flex flex-col gap-1.5">
        <select
          value={specKey(cfg.provider, cfg.model)}
          onChange={(e) => {
            const [provider, model] = decodeSpecKey(e.target.value);
            onModelChange(provider, model);
          }}
          className="nodrag w-full border border-[color:var(--color-rule)] bg-transparent px-1.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-fg)]"
        >
          {catalog.map((s) => (
            <option key={specKey(s.provider, s.id)} value={specKey(s.provider, s.id)} className="bg-[color:var(--color-bg)]">
              {s.provider} · {s.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setContextOpen((o) => !o)}
          className="nodrag flex items-center justify-between border border-[color:var(--color-rule)] px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          <span>{contextOpen ? "[−]" : "[+]"} context</span>
          <span className="text-[color:var(--color-fg)]/60">{cfg.context.length} ch</span>
        </button>
        {contextOpen && (
          <textarea
            value={cfg.context}
            onChange={(e) => updateConfig({ context: e.target.value })}
            rows={5}
            className="nodrag w-full resize-none border border-[color:var(--color-rule)] bg-transparent p-2 text-[10px] leading-snug text-[color:var(--color-fg)] focus:border-[color:var(--color-ink)] focus:outline-none"
          />
        )}

        {spec && spec.config.length > 0 && (
          <ConfigFields
            fields={spec.config}
            values={cfg.params}
            onChange={(patch) =>
              updateConfig({ params: { ...cfg.params, ...patch } } as Partial<NodeData["config"]>)
            }
          />
        )}

        {d.status === "running" && <Working label="thinking" />}

        {d.status !== "running" && d.output?.text && (
          <div className="flex flex-col gap-1">
            <p className="line-clamp-3 border-l-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)]/5 px-2 py-1 text-[10px] leading-snug text-[color:var(--color-fg)]">
              {d.output.text}
            </p>
            <div className="flex justify-end text-[9px] uppercase tracking-[0.16em]">
              <CopyButton onCopy={() => copyText(d.output!.text!)} />
            </div>
          </div>
        )}
        {d.error && (
          <p className="line-clamp-2 text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-rec)]">
            ! {d.error}
          </p>
        )}
      </div>
    </NodeShell>
  );
}

function specKey(provider: ProviderId, model: string): string {
  return `${provider}::${model}`;
}
function decodeSpecKey(key: string): [ProviderId, string] {
  const [p, ...rest] = key.split("::");
  return [p as ProviderId, rest.join("::")];
}
