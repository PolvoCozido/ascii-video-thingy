"use client";

import { useReactFlow } from "@xyflow/react";
import {
  clearLibrary,
  removeLibraryEntry,
  useLibrary,
  useLibraryToggle,
  type LibraryEntry,
} from "@/lib/library";
import type { NodeData } from "@/lib/flow/types";

export function LibraryDrawer() {
  const { close } = useLibraryToggle();
  const entries = useLibrary();
  const { setNodes, getViewport, screenToFlowPosition } = useReactFlow();

  const addAsUploadNode = (entry: LibraryEntry) => {
    // Drop the new node near the center of the visible viewport.
    let position = { x: 200, y: 200 };
    try {
      const vw = window.innerWidth / 2;
      const vh = window.innerHeight / 2;
      position = screenToFlowPosition({ x: vw, y: vh });
    } catch {
      const vp = getViewport();
      position = { x: -vp.x / vp.zoom + 200, y: -vp.y / vp.zoom + 200 };
    }

    const data: NodeData = {
      config: {
        kind: "upload",
        url: entry.url,
        mediaType: entry.mediaType,
        label: entry.prompt?.slice(0, 60) || `${entry.provider}·${entry.model}`,
      },
      status: "done",
      output: { media: { url: entry.url, mediaType: entry.mediaType } },
    };

    setNodes((prev) => [
      ...prev,
      {
        id: `upload-${Date.now().toString(36)}`,
        type: "upload",
        position,
        data: data as unknown as Record<string, unknown>,
      },
    ]);
    close();
  };

  const download = (entry: LibraryEntry) => {
    const a = document.createElement("a");
    a.download = `${entry.provider ?? "media"}-${entry.id.slice(0, 8)}.${entry.mediaType === "video" ? "mp4" : "png"}`;
    a.href = entry.url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/60"
      onClick={close}
    >
      <aside
        className="flex h-full w-full max-w-2xl flex-col gap-4 overflow-hidden border-l border-[color:var(--color-rule)] bg-[color:var(--color-bg)] p-5 text-[color:var(--color-fg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-[color:var(--color-rule)] pb-3">
          <div className="flex items-baseline gap-4">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em]">
              {">"} library
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
              {entries.length} item{entries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em]">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("clear the entire library?")) clearLibrary();
                }}
                className="text-[color:var(--color-muted)] hover:text-[color:var(--color-rec)]"
              >
                [clear all]
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            >
              [close]
            </button>
          </div>
        </header>

        {entries.length === 0 ? (
          <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
            every successful generation lands here. run a flow to populate.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {entries.map((e) => (
              <LibraryCard
                key={e.id}
                entry={e}
                onAdd={() => addAsUploadNode(e)}
                onDownload={() => download(e)}
                onRemove={() => removeLibraryEntry(e.id)}
              />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function LibraryCard({
  entry,
  onAdd,
  onDownload,
  onRemove,
}: {
  entry: LibraryEntry;
  onAdd: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const when = new Date(entry.createdAt).toLocaleString();
  return (
    <li className="flex flex-col gap-1.5 border border-[color:var(--color-rule)] bg-black/40 p-2">
      <div className="relative aspect-square w-full overflow-hidden border border-[color:var(--color-rule)] bg-black">
        {entry.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.url} alt={entry.prompt ?? ""} className="h-full w-full object-cover" />
        ) : (
          <video
            src={entry.url}
            muted
            loop
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute right-1 top-1 border border-[color:var(--color-rule)] bg-black/70 px-1 text-[8px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
          {entry.mediaType}
        </span>
      </div>
      <p className="line-clamp-2 text-[10px] leading-tight text-[color:var(--color-fg)]" title={entry.prompt}>
        {entry.prompt || <span className="text-[color:var(--color-muted)]">(no prompt)</span>}
      </p>
      <div className="flex items-baseline justify-between text-[8px] uppercase tracking-[0.16em] text-[color:var(--color-muted)]">
        <span className="truncate" title={`${entry.provider} · ${entry.model}`}>
          {entry.provider} · {entry.model}
        </span>
        <span title={when}>{relTime(entry.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-[color:var(--color-rule)] pt-1 text-[9px] uppercase tracking-[0.16em]">
        <button
          type="button"
          onClick={onAdd}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
          title="add as upload node"
        >
          [+ node]
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
          title="download original"
        >
          [↓ dl]
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-rec)]"
          title="remove from library"
        >
          [✕]
        </button>
      </div>
    </li>
  );
}

function relTime(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
