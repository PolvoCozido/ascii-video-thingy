"use client";

import type { EnumOption, ModelConfigField } from "@/lib/models/types";

export function ConfigFields({
  fields,
  values,
  onChange,
}: {
  fields: ModelConfigField[];
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {fields.map((f) => (
        <Field key={f.name} field={f} value={values[f.name]} onChange={(v) => onChange({ [f.name]: v })} />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ModelConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = field.label ?? field.name;

  if (field.type === "enum") {
    const current = value ?? field.default ?? "";
    return (
      <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
        <span className="w-20 text-[color:var(--color-muted)]" title={label}>{label}</span>
        <select
          value={String(current)}
          onChange={(e) => {
            const opt = field.options.find((o) => String(getOptionValue(o)) === e.target.value);
            onChange(opt !== undefined ? getOptionValue(opt) : e.target.value);
          }}
          className="nodrag flex-1 border border-[color:var(--color-rule)] bg-transparent px-1.5 py-1 text-[color:var(--color-fg)]"
        >
          {field.options.map((opt) => (
            <option key={String(getOptionValue(opt))} value={String(getOptionValue(opt))} className="bg-[color:var(--color-bg)]">
              {getOptionLabel(opt)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "number") {
    const current = value as number | null | undefined;
    return (
      <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
        <span className="w-20 text-[color:var(--color-muted)]" title={label}>{label}{field.unit ? ` (${field.unit})` : ""}</span>
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={current ?? ""}
          placeholder={field.default === null ? "auto" : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          className="nodrag flex-1 border border-[color:var(--color-rule)] bg-transparent px-1.5 py-1 text-right tabular-nums text-[color:var(--color-fg)]"
        />
      </label>
    );
  }

  if (field.type === "bool") {
    const current = (value as boolean | undefined) ?? field.default;
    return (
      <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
        <span className="w-20 text-[color:var(--color-muted)]" title={label}>{label}</span>
        <button
          type="button"
          onClick={() => onChange(!current)}
          className={[
            "nodrag flex-1 border px-1.5 py-1 text-left transition",
            current
              ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)]/10 text-[color:var(--color-ink)]"
              : "border-[color:var(--color-rule)] text-[color:var(--color-muted)]",
          ].join(" ")}
        >
          {current ? "[ on ]" : "[ off ]"}
        </button>
      </label>
    );
  }

  if (field.type === "text") {
    const current = (value as string | undefined) ?? field.default;
    return (
      <label className="flex flex-col gap-0.5 text-[9px] uppercase tracking-[0.14em]">
        <span className="text-[color:var(--color-muted)]">{label}</span>
        <textarea
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className="nodrag w-full resize-none border border-[color:var(--color-rule)] bg-transparent p-1.5 text-[10px] normal-case tracking-normal text-[color:var(--color-fg)] placeholder:text-[color:var(--color-muted)]/60 focus:border-[color:var(--color-ink)] focus:outline-none"
        />
      </label>
    );
  }

  return null;
}

function getOptionValue(opt: EnumOption): string | number {
  if (typeof opt === "object" && opt !== null && "value" in opt) return opt.value;
  return opt;
}

function getOptionLabel(opt: EnumOption): string {
  if (typeof opt === "object" && opt !== null && "label" in opt) return opt.label;
  return String(opt);
}
