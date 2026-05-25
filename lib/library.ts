"use client";

import { useEffect, useSyncExternalStore } from "react";

export type LibraryEntry = {
  id: string;
  url: string;
  mediaType: "image" | "video";
  provider?: string;
  model?: string;
  prompt?: string;        // upstream text input, if any
  createdAt: number;
};

const STORAGE_KEY = "ascii-video-thingy:library:v1";
const MAX_ENTRIES = 100;

let entries: LibraryEntry[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryEntry[];
      if (Array.isArray(parsed)) entries = parsed;
    }
  } catch {
    // ignore corrupt storage
  }
}

function flush(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota or disabled — ignore
  }
}

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  hydrate();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function pushLibraryEntry(entry: Omit<LibraryEntry, "id" | "createdAt"> & Partial<Pick<LibraryEntry, "id" | "createdAt">>): LibraryEntry {
  hydrate();
  const full: LibraryEntry = {
    id: entry.id ?? crypto.randomUUID(),
    createdAt: entry.createdAt ?? Date.now(),
    ...entry,
  };
  // Skip blob: URLs (they don't survive reload).
  if (full.url.startsWith("blob:")) return full;
  // Skip duplicates by url.
  if (entries.some((e) => e.url === full.url)) return full;
  entries = [full, ...entries].slice(0, MAX_ENTRIES);
  flush();
  notify();
  return full;
}

export function removeLibraryEntry(id: string): void {
  hydrate();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  entries = next;
  flush();
  notify();
}

export function clearLibrary(): void {
  hydrate();
  if (entries.length === 0) return;
  entries = [];
  flush();
  notify();
}

export function useLibrary(): LibraryEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => entries,
    () => [],
  );
}

// ---- drawer open/close (module-scoped, same pattern as SettingsDrawer) ----

let drawerOpen = false;
const drawerListeners = new Set<() => void>();

function subscribeDrawer(l: () => void) {
  drawerListeners.add(l);
  return () => drawerListeners.delete(l);
}
function getDrawerSnapshot() { return drawerOpen; }
function setDrawerOpen(next: boolean) {
  if (drawerOpen === next) return;
  drawerOpen = next;
  for (const l of drawerListeners) l();
}

export function useLibraryToggle() {
  const isOpen = useSyncExternalStore(subscribeDrawer, getDrawerSnapshot, () => false);
  return {
    isOpen,
    open: () => setDrawerOpen(true),
    close: () => setDrawerOpen(false),
    toggle: () => setDrawerOpen(!drawerOpen),
  };
}

// Convenience hook for components that just want to ensure the library is hydrated.
export function useEnsureLibraryHydrated(): void {
  useEffect(() => {
    hydrate();
  }, []);
}
