import { FAL_SPECS } from "./specs/fal";
import { OPENAI_SPECS } from "./specs/openai";
import { REPLICATE_SPECS } from "./specs/replicate";
import type { ModelSpec, ModelOutput } from "./types";
import type { ProviderId } from "@/lib/providers/types";

const ALL_SPECS: ModelSpec[] = [...FAL_SPECS, ...OPENAI_SPECS, ...REPLICATE_SPECS];

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

export function specsForKind(kind: "imageGen" | "edit" | "videoGen" | "prompt"): ModelSpec[] {
  switch (kind) {
    case "imageGen":
      // Any image-output model: text-only, optional-image, or image+text.
      // The selected model's spec decides whether an image input handle appears.
      return ALL_SPECS.filter((s) => s.output === "image");
    case "edit":
      // Edit kind narrows to models that REQUIRE an image input.
      return ALL_SPECS.filter(
        (s) => s.output === "image" && s.inputs.some((i) => i.type === "image" && i.required),
      );
    case "videoGen":
      return ALL_SPECS.filter((s) => s.output === "video");
    case "prompt":
      return ALL_SPECS.filter((s) => s.output === "text");
  }
}

export { ALL_SPECS };
