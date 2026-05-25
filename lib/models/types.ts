import type { ProviderId } from "@/lib/providers/types";

export type ModelOutput = "image" | "video" | "text";

export type ModelInput = {
  name: string;                 // handle id ("prompt", "start_image", "end_image", ...)
  type: "text" | "image" | "video";
  required: boolean;
  label?: string;               // display label; defaults to name
};

export type EnumOption = string | number | { value: string | number; label: string };

export type ModelConfigField =
  | { name: string; label?: string; type: "enum";   options: EnumOption[];        default: string | number | null }
  | { name: string; label?: string; type: "number"; min: number; max: number; step?: number; default: number | null; unit?: string }
  | { name: string; label?: string; type: "bool";   default: boolean }
  | { name: string; label?: string; type: "text";   default: string; placeholder?: string };

export type ModelSpec = {
  id: string;                   // full provider model id, e.g. "fal-ai/bytedance/seedance/v1/pro/image-to-video"
  provider: ProviderId;
  output: ModelOutput;
  label: string;                // short display label
  description?: string;
  inputs: ModelInput[];
  config: ModelConfigField[];
  /**
   * Build the request body for the provider given resolved inputs + user-set config.
   * Inputs map: name → value (text string for text inputs, url string for image/video inputs).
   * Config map: name → value (strings, numbers, booleans).
   */
  buildPayload: (vars: {
    inputs: Record<string, string | undefined>;
    config: Record<string, unknown>;
  }) => Record<string, unknown>;
};

export function defaultParams(spec: ModelSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec.config) out[f.name] = f.default;
  return out;
}
