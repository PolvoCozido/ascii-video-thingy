import { FAL_SPECS } from "./specs/fal";
import { KLING_SPECS } from "./specs/kling";
import { OPENAI_SPECS } from "./specs/openai";
import { REPLICATE_SPECS } from "./specs/replicate";
import { XAI_SPECS } from "./specs/xai";
import type { ModelSpec, ModelOutput } from "./types";
import type { ProviderId } from "@/lib/providers/types";

const ALL_SPECS: ModelSpec[] = [
  ...FAL_SPECS,
  ...OPENAI_SPECS,
  ...REPLICATE_SPECS,
  ...XAI_SPECS,
  ...KLING_SPECS,
];

const SPECS_BY_KEY = new Map<string, ModelSpec>();
for (const s of ALL_SPECS) SPECS_BY_KEY.set(key(s.provider, s.id), s);

function key(provider: ProviderId, id: string): string {
  return `${provider}::${id}`;
}

export function getSpec(provider: ProviderId, id: string): ModelSpec | undefined {
  return SPECS_BY_KEY.get(key(provider, id));
}

export function specsByOutput(output: ModelOutput): ModelSpec[] {
  return ALL_SPECS.filter((s) => s.output === output);
}

export function specsForKind(kind: "imageGen" | "videoGen" | "prompt"): ModelSpec[] {
  switch (kind) {
    case "imageGen":
      // Any image-output model: text-only, optional-image, or image+text
      // (former "edit" kind models — gpt-image-1 edit, flux dev img2img, redux — live here too).
      return ALL_SPECS.filter((s) => s.output === "image");
    case "videoGen":
      return ALL_SPECS.filter((s) => s.output === "video");
    case "prompt":
      return ALL_SPECS.filter((s) => s.output === "text");
  }
}

export { ALL_SPECS };
