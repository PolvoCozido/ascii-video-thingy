"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Small node-footer copy button. `onCopy` does the work (text, image, etc.) and
 * may return a short word ("url", "img") to flash instead of the default "copied".
 */
export function CopyButton({
  onCopy,
  disabled,
  className,
  idleLabel = "[ ⎘ copy ]",
}: {
  onCopy: () => Promise<string | void> | string | void;
  disabled?: boolean;
  className?: string;
  idleLabel?: string;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handle = useCallback(async () => {
    try {
      const word = (await onCopy()) || "copied";
      setFlash(typeof word === "string" ? word : "copied");
    } catch (err) {
      console.error("copy failed", err);
      setFlash("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 1200);
  }, [onCopy]);

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      title="copy to clipboard"
      className={[
        "nodrag transition disabled:opacity-40",
        flash
          ? "text-[color:var(--color-ink)]"
          : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]",
        className ?? "",
      ].join(" ")}
    >
      {flash ? `[ ✓ ${flash} ]` : idleLabel}
    </button>
  );
}
