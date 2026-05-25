"use client";

import { useState, useSyncExternalStore } from "react";
import { useKeys, usePicks } from "@/lib/keys";
import { PROVIDER_LIST } from "@/lib/providers";
import type { Stage } from "@/lib/providers/types";
import { specsByOutput } from "@/lib/models/registry";

let isOpenState = false;
const listeners = new Set<() => void>();
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return isOpenState; }
function setOpen(next: boolean) {
  if (isOpenState === next) return;
  isOpenState = next;
  for (const l of listeners) l();
}

export function useSettingsToggle() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpenState),
  };
}

const STAGE_TO_OUTPUT: Record<Stage, "image" | "video" | "text"> = {
  image: "image",
  video: "video",
  chat: "text",
};

export function SettingsDrawer() {
  const { close } = useSettingsToggle();
  const [keys, setKeys] = useKeys();
  const [picks, updatePick] = usePicks();
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const stages: Stage[] = ["chat", "image", "video"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60"
      onClick={close}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-[color:var(--color-rule)] bg-[color:var(--color-bg)] p-5 text-[color:var(--color-fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-[color:var(--color-rule)] pb-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em]">{">"} settings</h2>
          <button
            type="button"
            onClick={close}
            className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            [close]
          </button>
        </header>

        <section className="flex flex-col gap-3">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            api keys · stored in your browser only
          </h3>
          {PROVIDER_LIST.map((p) => {
            const shown = !!reveal[p.id];
            const value = keys[p.id] ?? "";
            return (
              <div key={p.id} className="flex flex-col gap-1">
                <label className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em]">
                  <span>{p.name}</span>
                  <span className="text-[color:var(--color-muted)]">{p.id}</span>
                </label>
                {p.id === "kling" ? (
                  <KlingKeyFields
                    value={value}
                    shown={shown}
                    onChange={(combined) => setKeys({ kling: combined })}
                    onReveal={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))}
                    onClear={() => setKeys({ kling: "" })}
                  />
                ) : (
                  <div className="flex items-stretch gap-1">
                    <input
                      type={shown ? "text" : "password"}
                      value={value}
                      onChange={(e) => setKeys({ [p.id]: e.target.value })}
                      placeholder={`paste ${p.name} key`}
                      spellCheck={false}
                      autoComplete="off"
                      className="flex-1 border border-[color:var(--color-rule)] bg-transparent px-2 py-1.5 text-[11px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-ink)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))}
                      className="border border-[color:var(--color-rule)] px-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
                    >
                      {shown ? "hide" : "show"}
                    </button>
                    {value && (
                      <button
                        type="button"
                        onClick={() => setKeys({ [p.id]: "" })}
                        className="border border-[color:var(--color-rule)] px-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)] hover:text-[color:var(--color-rec)]"
                      >
                        del
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            default model per stage · used when a node is created
          </h3>
          {stages.map((stage) => {
            const specs = stageSpecs(stage);
            const pickKey = `${picks[stage].provider}::${picks[stage].model}`;
            const known = specs.some((s) => `${s.provider}::${s.id}` === pickKey);
            return (
              <div key={stage} className="flex flex-col gap-1.5 border border-[color:var(--color-rule)] p-2">
                <span className="text-[10px] uppercase tracking-[0.18em]">{stage}</span>
                <select
                  value={pickKey}
                  onChange={(e) => {
                    const [provider, ...rest] = e.target.value.split("::");
                    const model = rest.join("::");
                    updatePick(stage, { provider: provider as typeof picks[Stage]["provider"], model });
                  }}
                  className="border border-[color:var(--color-rule)] bg-transparent px-1.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-fg)]"
                >
                  {specs.map((s) => (
                    <option key={`${s.provider}::${s.id}`} value={`${s.provider}::${s.id}`} className="bg-[color:var(--color-bg)]">
                      {s.provider} · {s.label}
                    </option>
                  ))}
                  {!known && (
                    <option value={pickKey} className="bg-[color:var(--color-bg)]">
                      {picks[stage].provider} · {picks[stage].model} (custom)
                    </option>
                  )}
                </select>
              </div>
            );
          })}
        </section>

        <p className="mt-auto text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
          keys never leave your browser except as a per-request header to your local /api routes.
        </p>
      </aside>
    </div>
  );
}

function stageSpecs(stage: Stage) {
  return specsByOutput(STAGE_TO_OUTPUT[stage]);
}

/**
 * Two-field input for Kling — pastes access_key and secret_key separately,
 * stored combined as "access:secret" so the kling provider (which signs JWT
 * server-side from that format) doesn't need to change.
 */
function KlingKeyFields({
  value,
  shown,
  onChange,
  onReveal,
  onClear,
}: {
  value: string;
  shown: boolean;
  onChange: (combined: string) => void;
  onReveal: () => void;
  onClear: () => void;
}) {
  const idx = value.indexOf(":");
  const access = idx >= 0 ? value.slice(0, idx) : value;
  const secret = idx >= 0 ? value.slice(idx + 1) : "";

  const writeAccess = (a: string) => onChange(`${a}:${secret}`);
  const writeSecret = (s: string) => onChange(`${access}:${s}`);

  const inputCls =
    "min-w-0 flex-1 border border-[color:var(--color-rule)] bg-transparent px-2 py-1.5 text-[11px] text-[color:var(--color-fg)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-ink)] focus:outline-none";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1">
        <span className="flex w-20 items-center justify-end pr-1 text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          access
        </span>
        <input
          type={shown ? "text" : "password"}
          value={access}
          onChange={(e) => writeAccess(e.target.value)}
          placeholder="access_key"
          spellCheck={false}
          autoComplete="off"
          className={inputCls}
        />
      </div>
      <div className="flex items-stretch gap-1">
        <span className="flex w-20 items-center justify-end pr-1 text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          secret
        </span>
        <input
          type={shown ? "text" : "password"}
          value={secret}
          onChange={(e) => writeSecret(e.target.value)}
          placeholder="secret_key"
          spellCheck={false}
          autoComplete="off"
          className={inputCls}
        />
        <button
          type="button"
          onClick={onReveal}
          className="border border-[color:var(--color-rule)] px-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          {shown ? "hide" : "show"}
        </button>
        {(access || secret) && (
          <button
            type="button"
            onClick={onClear}
            className="border border-[color:var(--color-rule)] px-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)] hover:text-[color:var(--color-rec)]"
          >
            del
          </button>
        )}
      </div>
      <p className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
        we sign a JWT per request from both values — never sent to Kling raw.
      </p>
    </div>
  );
}
