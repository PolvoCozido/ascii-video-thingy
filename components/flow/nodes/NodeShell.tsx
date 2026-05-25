"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { runFromNode } from "@/lib/flow/control";
import type { RunStatus } from "@/lib/flow/types";

const STATUS_DOT: Record<RunStatus, string> = {
  idle: "bg-[color:var(--color-muted)]",
  running: "bg-[color:var(--color-ink)] animate-pulse",
  done: "bg-[color:var(--color-ink)]",
  error: "bg-[color:var(--color-rec)]",
};

const HEADER_H = 28;
const PORTS_PT = 6;
const ROW_H = 18;

const HANDLE_STYLE = {
  width: 10,
  height: 10,
  borderRadius: 0,
  border: "1px solid var(--color-bg)",
} as const;

export type ShellPort = { name: string; label?: string; type: "text" | "image" | "video" };

export function NodeShell({
  id,
  label,
  status,
  selected,
  inputs,
  outputs,
  children,
  width = 240,
}: {
  id: string;
  label: string;
  status: RunStatus;
  selected?: boolean;
  inputs: ShellPort[];
  outputs: ShellPort[];
  children: ReactNode;
  width?: number;
}) {
  const totalRows = inputs.length + outputs.length;

  return (
    <div
      style={{ width }}
      className={[
        "relative border bg-[color:var(--color-bg)] text-[color:var(--color-fg)]",
        selected ? "border-[color:var(--color-ink)]" : "border-[color:var(--color-rule)]",
      ].join(" ")}
    >
      <header
        className="flex items-center justify-between gap-2 border-b border-[color:var(--color-rule)] px-2"
        style={{ height: HEADER_H }}
      >
        <span className="text-[10px] uppercase tracking-[0.16em]">{label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); runFromNode(id); }}
            className="nodrag text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-muted)] transition hover:text-[color:var(--color-ink)]"
            title="run from here"
          >
            [▶]
          </button>
          <span className={`block h-1.5 w-1.5 ${STATUS_DOT[status]}`} aria-hidden />
        </div>
      </header>

      {totalRows > 0 && (
        <div
          className="flex flex-col border-b border-[color:var(--color-rule)] text-[9px] uppercase tracking-[0.14em]"
          style={{ paddingTop: PORTS_PT, paddingBottom: PORTS_PT }}
        >
          {inputs.map((p) => (
            <div
              key={`in-label-${p.name}`}
              className="flex items-center pl-3 pr-2 text-[color:var(--color-muted)]"
              style={{ height: ROW_H }}
              title={`${p.label ?? p.name} · ${p.type}`}
            >
              <span className="truncate">↳ {p.label ?? p.name}</span>
              <span className="ml-auto text-[7px] tracking-[0.2em] text-[color:var(--color-muted)]/60">{p.type}</span>
            </div>
          ))}
          {outputs.map((p) => (
            <div
              key={`out-label-${p.name}`}
              className="flex items-center justify-end pl-2 pr-3 text-[color:var(--color-muted)]"
              style={{ height: ROW_H }}
              title={`${p.label ?? p.name} · ${p.type}`}
            >
              <span className="text-[7px] tracking-[0.2em] text-[color:var(--color-muted)]/60">{p.type}</span>
              <span className="ml-auto truncate">{p.label ?? p.name} ↦</span>
            </div>
          ))}
        </div>
      )}

      {inputs.map((p, idx) => (
        <Handle
          key={`in-handle-${p.name}`}
          id={p.name}
          type="target"
          position={Position.Left}
          isConnectable
          style={{
            ...HANDLE_STYLE,
            background: p.type === "text" ? "var(--color-fg)" : "var(--color-ink)",
            top: HEADER_H + PORTS_PT + idx * ROW_H + ROW_H / 2,
          }}
        />
      ))}
      {outputs.map((p, idx) => (
        <Handle
          key={`out-handle-${p.name}`}
          id={p.name}
          type="source"
          position={Position.Right}
          isConnectable
          style={{
            ...HANDLE_STYLE,
            background: p.type === "text" ? "var(--color-fg)" : "var(--color-ink)",
            top: HEADER_H + PORTS_PT + (inputs.length + idx) * ROW_H + ROW_H / 2,
          }}
        />
      ))}

      <div className="p-2">{children}</div>
    </div>
  );
}
