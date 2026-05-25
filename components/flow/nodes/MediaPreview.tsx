"use client";

import type { MediaValue } from "@/lib/flow/types";

/**
 * Inline thumbnail of a node's media — the generated image/video (or an
 * uploaded file). Click opens the original in a new tab. `object-contain`
 * keeps both portrait and landscape results fully visible.
 */
export function MediaPreview({ media, label }: { media: MediaValue; label?: string }) {
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      title="open original in a new tab"
      className="nodrag group relative block w-full overflow-hidden border border-[color:var(--color-rule)] bg-black"
    >
      {media.mediaType === "video" ? (
        <video
          src={media.url}
          className="block max-h-44 w-full object-contain"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote provider URLs, no Image optimization wanted
        <img src={media.url} alt={label ?? "result"} className="block max-h-44 w-full object-contain" />
      )}
      <span className="pointer-events-none absolute right-1 top-1 bg-[color:var(--color-bg)]/70 px-1 text-[7px] uppercase tracking-[0.16em] text-[color:var(--color-muted)] opacity-0 transition group-hover:opacity-100">
        ↗ {media.mediaType}
      </span>
    </a>
  );
}
