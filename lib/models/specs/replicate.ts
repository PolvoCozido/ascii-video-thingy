import type { ModelSpec } from "../types";

const fluxSchnellRep: ModelSpec = {
  id: "black-forest-labs/flux-schnell",
  provider: "replicate",
  output: "image",
  label: "Flux Schnell",
  description: "Replicate / black-forest-labs",
  inputs: [{ name: "prompt", type: "text", required: true }],
  config: [
    { name: "aspect_ratio", type: "enum", options: ["1:1", "16:9", "9:16", "4:3", "3:4"], default: "1:1" },
    { name: "num_outputs", type: "number", min: 1, max: 4, step: 1, default: 1 },
  ],
  buildPayload: ({ inputs, config }) => ({
    prompt: inputs.prompt,
    aspect_ratio: config.aspect_ratio,
    num_outputs: config.num_outputs,
  }),
};

const seedanceProRep: ModelSpec = {
  id: "bytedance/seedance-1-pro",
  provider: "replicate",
  output: "video",
  label: "Seedance 1 Pro",
  inputs: [
    { name: "prompt", type: "text", required: true },
    { name: "start_image", type: "image", required: false, label: "image (optional)" },
  ],
  config: [
    { name: "duration", type: "enum", options: [{ value: 5, label: "5s" }, { value: 10, label: "10s" }], default: 5 },
    { name: "resolution", type: "enum", options: ["480p", "720p", "1080p"], default: "720p" },
    { name: "aspect_ratio", type: "enum", options: ["16:9", "9:16", "1:1"], default: "16:9" },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { prompt: inputs.prompt };
    if (inputs.start_image) out.image = inputs.start_image;
    if (config.duration) out.duration = config.duration;
    if (config.resolution) out.resolution = config.resolution;
    if (config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
    return out;
  },
};

export const REPLICATE_SPECS: ModelSpec[] = [fluxSchnellRep, seedanceProRep];
