"use client";

import type { NodeProps } from "@xyflow/react";
import { useNodeUpdate } from "@/lib/flow/useNodeUpdate";
import { useModelChange } from "@/lib/flow/useModelChange";
import type { NodeData } from "@/lib/flow/types";
import { getSpec, specsForKind } from "@/lib/models/registry";
import type { ProviderId } from "@/lib/providers/types";
import { copyImageFromUrl, copyText } from "@/lib/clipboard";
import { ConfigFields } from "./ConfigFields";
import { CopyButton } from "./CopyButton";
import { MediaPreview } from "./MediaPreview";
import { NodeShell, type ShellPort } from "./NodeShell";
import { Working } from "./Working";

type Kind = "imageGen" | "videoGen";
const LABELS: Record<Kind, string> = {
  imageGen: "image gen",
  videoGen: "video gen",
};

export function ProviderNode(props: NodeProps & { kind: Kind }) {
  const { id, data, selected, kind } = props;
  const d = data as unknown as NodeData;
  const cfg = d.config as Extract<NodeData["config"], { kind: Kind }>;
  const updateConfig = useNodeUpdate(id);
  const onModelChange = useModelChange(id);

  const spec = getSpec(cfg.provider, cfg.model);
  const catalog = specsForKind(kind);

  const inputs: ShellPort[] = spec ? spec.inputs.map((i) => ({ name: i.name, label: i.label, type: i.type })) : [];
  const outputs: ShellPort[] = spec
    ? [{ name: spec.output === "text" ? "text" : "media", type: spec.output === "text" ? "text" : "image" }]
    : [];

  return (
    <NodeShell
      id={id}
      label={LABELS[kind]}
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
          {!spec && (
            <option value={specKey(cfg.provider, cfg.model)} className="bg-[color:var(--color-bg)]">
              {cfg.provider} · {cfg.model} (unknown)
            </option>
          )}
        </select>

        {spec && (
          <ConfigFields
            fields={spec.config}
            values={cfg.params}
            onChange={(patch) =>
              updateConfig({ params: { ...cfg.params, ...patch } } as Partial<NodeData["config"]>)
            }
          />
        )}

        {d.status === "running" && <Working label={kind === "videoGen" ? "rendering" : "generating"} media />}

        {d.status !== "running" && d.output?.media && (
          <div className="flex flex-col gap-1">
            <MediaPreview media={d.output.media} label={cfg.model} />
            <div className="flex justify-end text-[9px] uppercase tracking-[0.16em]">
              <CopyButton
                onCopy={() =>
                  d.output!.media!.mediaType === "image"
                    ? copyImageFromUrl(d.output!.media!.url)
                    : copyText(d.output!.media!.url).then(() => "url")
                }
              />
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
