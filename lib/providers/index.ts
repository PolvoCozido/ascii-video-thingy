import { fal } from "./fal";
import { openai } from "./openai";
import { replicate } from "./replicate";
import { ProviderAdapter, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  fal,
  replicate,
  openai,
};

export const PROVIDER_LIST: ProviderAdapter[] = [fal, replicate, openai];

export function getProvider(id: string): ProviderAdapter {
  const p = (PROVIDERS as Record<string, ProviderAdapter | undefined>)[id];
  if (!p) throw new Error(`unknown provider: ${id}`);
  return p;
}

export * from "./types";
