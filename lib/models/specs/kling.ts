import type { ModelConfigField, ModelSpec } from "../types";

/** Base fields shared between i2v and t2v. */
const BASE_CONFIG: ModelConfigField[] = [
  { name: "duration",        type: "enum",   options: [{ value: "5", label: "5s" }, { value: "10", label: "10s" }], default: "5" },
  { name: "negative_prompt", type: "text",   default: "",                              placeholder: "things to avoid" },
];

/** cfg_scale is only honored by v1.x — v2.x "master" models reject it. */
const CFG_FIELD: ModelConfigField = {
  name: "cfg_scale",
  type: "number",
  min: 0,
  max: 1,
  step: 0.05,
  default: 0.5,
};

/** aspect_ratio is t2v-only — i2v models infer aspect from the input image. */
const ASPECT_FIELD: ModelConfigField = {
  name: "aspect_ratio",
  type: "enum",
  options: ["16:9", "9:16", "1:1"],
  default: "16:9",
};

/** v1.x models add std/pro `mode`. v2.x models always run in pro and reject the field. */
const MODE_FIELD: ModelConfigField = {
  name: "mode",
  type: "enum",
  options: ["std", "pro"],
  default: "std",
};

type Variant = "v1" | "v2";
type Endpoint = "/v1/videos/image2video" | "/v1/videos/text2video";

function kling_video(
  modelId: string,
  label: string,
  variant: Variant,
  endpoint: Endpoint,
): ModelSpec {
  const isI2V = endpoint === "/v1/videos/image2video";
  const isT2V = endpoint === "/v1/videos/text2video";
  // i2v: aspect inferred from image. t2v: must be selected.
  const aspectFields = isT2V ? [ASPECT_FIELD] : [];
  const modeFields = variant === "v1" ? [MODE_FIELD] : [];
  const cfgFields = variant === "v1" ? [CFG_FIELD] : [];
  const config = [...modeFields, ...cfgFields, ...BASE_CONFIG, ...aspectFields];

  return {
    id: isT2V ? `${modelId}:t2v` : modelId,
    provider: "kling",
    output: "video",
    label,
    description: isT2V ? "Kling text-to-video" : "Kling image-to-video",
    inputs: isI2V
      ? [
          { name: "image",  type: "image", required: true, label: "start image" },
          // image_tail (first→last frame interpolation) is only supported on v1.x;
          // v2/v2.1 master reject it. Conditionally expose the handle.
          ...(variant === "v1"
            ? ([{ name: "image_tail", type: "image", required: false, label: "end image (tail)" }] as const)
            : []),
          { name: "prompt", type: "text", required: true, label: "prompt" },
        ]
      : [{ name: "prompt", type: "text", required: true }],
    config,
    buildPayload: ({ inputs, config }) => {
      const out: Record<string, unknown> = {
        __endpoint: endpoint,
        model_name: modelId,
        prompt: inputs.prompt,
      };
      if (isI2V) {
        out.image = inputs.image;
        // image_tail is v1-only — guard so a stale wired edge can't smuggle it.
        if (variant === "v1" && inputs.image_tail) out.image_tail = inputs.image_tail;
      }
      // v2 models reject `mode` and `cfg_scale` — only emit them for v1.x.
      if (variant === "v1" && config.mode) out.mode = config.mode;
      if (variant === "v1" && typeof config.cfg_scale === "number") out.cfg_scale = config.cfg_scale;
      if (config.duration) out.duration = config.duration;
      // aspect_ratio only on t2v; i2v rejects it.
      if (isT2V && config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
      if (typeof config.negative_prompt === "string" && config.negative_prompt) {
        out.negative_prompt = config.negative_prompt;
      }
      return out;
    },
  };
}

export const KLING_SPECS: ModelSpec[] = [
  kling_video("kling-v2-1-master", "Kling v2.1 Master · i2v", "v2", "/v1/videos/image2video"),
  kling_video("kling-v2-master",   "Kling v2 Master · i2v",   "v2", "/v1/videos/image2video"),
  kling_video("kling-v1-6",        "Kling v1.6 · i2v",        "v1", "/v1/videos/image2video"),
  kling_video("kling-v1-6",        "Kling v1.6 · t2v",        "v1", "/v1/videos/text2video"),
];
