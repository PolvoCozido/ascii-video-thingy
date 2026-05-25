"use client";

import type { MediaValue } from "@/lib/flow/types";

/**
 * Inline preview of a node's media. Videos render as a real player (controls +
 * autoplay-loop) so they can be scrubbed in place; images render as a thumbnail.
 * A small corner link opens the source in a new tab for both. `object-contain`
 * keeps portrait and landscape results fully visible.
 */
export function MediaPreview({
  media,
  label,
  pixelated,
}: {
  media: MediaValue;
  label?: string;
  pixelated?: boolean;
}) {
  const style = pixelated ? { imageRendering: "pixelated" as const } : undefined;
  return (
    <div className="group relative w-full overflow-hidden border border-[color:var(--color-rule)] bg-black">
      {media.mediaType === "video" ? (
        <video
          src={media.url}
          className="nodrag block max-h-44 w-full object-contain"
          style={style}
          controls
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote provider URLs, no Image optimization wanted
        <img src={media.url} alt={label ?? "result"} className="block max-h-44 w-full object-contain" style={style} />
      )}
      <button
        type="button"
        title="open original in a new tab"
        onClick={(e) => {
          e.stopPropagation();
          window.open(media.url, "_blank", "noreferrer");
        }}
        className="nodrag absolute right-1 top-1 z-10 bg-[color:var(--color-bg)]/70 px-1 text-[7px] uppercase tracking-[0.16em] text-[color:var(--color-muted)] opacity-0 transition hover:text-[color:var(--color-ink)] group-hover:opacity-100"
      >
        ↗ open
      </button>
    </div>
  );
}
