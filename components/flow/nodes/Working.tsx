"use client";

import { useEffect, useState } from "react";

const FRAMES = ["▱▱▱▱", "▰▱▱▱", "▰▰▱▱", "▰▰▰▱", "▰▰▰▰", "▱▰▰▰", "▱▱▰▰", "▱▱▱▰"];

function useTicker(active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((n) => (n + 1) % FRAMES.length), 120);
    return () => clearInterval(id);
  }, [active]);
  return FRAMES[i];
}

/** Animated "working" placeholder shown in a node body while it runs. */
export function Working({ label = "working", media = false }: { label?: string; media?: boolean }) {
  const frame = useTicker(true);
  const inner = (
    <span className="text-[9px] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
      {frame} {label} {frame}
    </span>
  );
  if (media) {
    return (
      <div className="flex aspect-video w-full items-center justify-center border border-[color:var(--color-rule)] bg-black">
        {inner}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center border-l-2 border-[color:var(--color-ink)] bg-[color:var(--color-ink)]/5 px-2 py-1.5">
      {inner}
    </div>
  );
}
