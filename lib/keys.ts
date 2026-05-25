"use client";

import { useEffect, useState } from "react";
import type { ProviderId, Stage } from "./providers/types";

const KEYS_STORAGE = "ascii-video-thingy:keys:v1";
const PICKS_STORAGE = "ascii-video-thingy:picks:v1";

export type KeysMap = Partial<Record<ProviderId, string>>;

export type PickMap = {
  // for each stage, which provider + model to use
  image: { provider: ProviderId; model: string };
  edit: { provider: ProviderId; model: string };
  video: { provider: ProviderId; model: string };
  chat: { provider: ProviderId; model: string };
};

export const DEFAULT_PICKS: PickMap = {
  image: { provider: "openai", model: "gpt-image-1" },
  edit: { provider: "openai", model: "gpt-image-1" },
  video: { provider: "fal", model: "fal-ai/bytedance/seedance/v1/pro/image-to-video" },
  chat: { provider: "openai", model: "gpt-4o-mini" },
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function useKeys(): [KeysMap, (patch: Partial<KeysMap>) => void] {
  const [keys, setKeys] = useState<KeysMap>({});
  useEffect(() => {
    setKeys(read<KeysMap>(KEYS_STORAGE, {}));
  }, []);
  const update = (patch: Partial<KeysMap>) => {
    setKeys((prev) => {
      const next = { ...prev, ...patch };
      write(KEYS_STORAGE, next);
      return next;
    });
  };
  return [keys, update];
}

export function usePicks(): [PickMap, (stage: Stage, patch: Partial<PickMap[Stage]>) => void] {
  const [picks, setPicks] = useState<PickMap>(DEFAULT_PICKS);
  useEffect(() => {
    setPicks(read<PickMap>(PICKS_STORAGE, DEFAULT_PICKS));
  }, []);
  const update = (stage: Stage, patch: Partial<PickMap[Stage]>) => {
    setPicks((prev) => {
      const next = { ...prev, [stage]: { ...prev[stage], ...patch } };
      write(PICKS_STORAGE, next);
      return next;
    });
  };
  return [picks, update];
}

export function readKeySync(provider: ProviderId): string | undefined {
  return read<KeysMap>(KEYS_STORAGE, {})[provider];
}

export function readPicksSync(): PickMap {
  return read<PickMap>(PICKS_STORAGE, DEFAULT_PICKS);
}
