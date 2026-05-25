import type { ModelSpec } from "../types";

const fluxSchnell: ModelSpec = {
  id: "fal-ai/flux/schnell",
  provider: "fal",
  output: "image",
  label: "Flux Schnell",
  description: "Fast 4-step image generation",
  inputs: [{ name: "prompt", type: "text", required: true }],
  config: [
    { name: "image_size", type: "enum", options: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], default: "square_hd" },
    { name: "num_inference_steps", type: "number", min: 1, max: 12, step: 1, default: 4 },
    { name: "seed", type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { prompt: inputs.prompt };
    if (config.image_size) out.image_size = config.image_size;
    if (typeof config.num_inference_steps === "number") out.num_inference_steps = config.num_inference_steps;
    if (typeof config.seed === "number") out.seed = config.seed;
    return out;
  },
};

const fluxDev: ModelSpec = {
  id: "fal-ai/flux/dev",
  provider: "fal",
  output: "image",
  label: "Flux Dev",
  description: "Higher quality, 28-step image generation",
  inputs: [{ name: "prompt", type: "text", required: true }],
  config: [
    { name: "image_size", type: "enum", options: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], default: "square_hd" },
    { name: "num_inference_steps", type: "number", min: 4, max: 50, step: 1, default: 28 },
    { name: "guidance_scale", type: "number", min: 1, max: 10, step: 0.1, default: 3.5 },
    { name: "seed", type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { prompt: inputs.prompt };
    for (const k of ["image_size", "num_inference_steps", "guidance_scale", "seed"]) {
      const v = config[k];
      if (v !== null && v !== undefined && v !== "") out[k] = v;
    }
    return out;
  },
};

const seedancePro: ModelSpec = {
  id: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
  provider: "fal",
  output: "video",
  label: "Seedance 1 Pro · i2v",
  description: "Image-to-video with first/last frame and reference",
  inputs: [
    { name: "prompt",      type: "text",  required: true,  label: "prompt"      },
    { name: "start_image", type: "image", required: true,  label: "start image" },
    { name: "end_image",   type: "image", required: false, label: "end image"   },
    { name: "reference",   type: "image", required: false, label: "reference"   },
  ],
  config: [
    { name: "resolution", type: "enum", options: ["480p", "720p", "1080p"], default: "720p" },
    { name: "duration",   type: "enum", options: [{ value: 5, label: "5s" }, { value: 10, label: "10s" }], default: 5 },
    { name: "aspect_ratio", type: "enum", options: ["16:9", "9:16", "1:1"], default: "16:9" },
    { name: "camera_fixed", type: "bool", default: false },
    { name: "seed", type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = {
      prompt: inputs.prompt,
      image_url: inputs.start_image,
    };
    if (inputs.end_image) out.end_image_url = inputs.end_image;
    if (inputs.reference) out.reference_image_url = inputs.reference;
    if (config.resolution) out.resolution = config.resolution;
    if (config.duration) out.duration = config.duration;
    if (config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
    if (config.camera_fixed) out.camera_fixed = true;
    if (typeof config.seed === "number") out.seed = config.seed;
    return out;
  },
};

const seedanceLite: ModelSpec = {
  ...seedancePro,
  id: "fal-ai/bytedance/seedance/v1/lite/image-to-video",
  label: "Seedance 1 Lite · i2v",
  description: "Cheaper, faster Seedance variant",
};

const klingI2V: ModelSpec = {
  id: "fal-ai/kling-video/v1.6/standard/image-to-video",
  provider: "fal",
  output: "video",
  label: "Kling 1.6 · i2v",
  description: "Kling image-to-video standard",
  inputs: [
    { name: "prompt",      type: "text",  required: true,  label: "prompt" },
    { name: "start_image", type: "image", required: true,  label: "start image" },
    { name: "end_image",   type: "image", required: false, label: "end image (tail frame)" },
  ],
  config: [
    { name: "duration", type: "enum", options: [{ value: "5", label: "5s" }, { value: "10", label: "10s" }], default: "5" },
    { name: "aspect_ratio", type: "enum", options: ["16:9", "9:16", "1:1"], default: "16:9" },
    { name: "negative_prompt", type: "text", default: "", placeholder: "things to avoid" },
    { name: "cfg_scale", type: "number", min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = {
      prompt: inputs.prompt,
      image_url: inputs.start_image,
    };
    if (inputs.end_image) out.tail_image_url = inputs.end_image;
    if (config.duration) out.duration = config.duration;
    if (config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
    if (typeof config.negative_prompt === "string" && config.negative_prompt) {
      out.negative_prompt = config.negative_prompt;
    }
    if (typeof config.cfg_scale === "number") out.cfg_scale = config.cfg_scale;
    return out;
  },
};

const ltxVideo: ModelSpec = {
  id: "fal-ai/ltx-video",
  provider: "fal",
  output: "video",
  label: "LTX Video",
  description: "Fast diffusion video, text or image conditioned",
  inputs: [
    { name: "prompt", type: "text", required: true },
    { name: "start_image", type: "image", required: false, label: "image (optional)" },
  ],
  config: [
    { name: "num_inference_steps", type: "number", min: 10, max: 60, step: 1, default: 30 },
    { name: "seed", type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { prompt: inputs.prompt };
    if (inputs.start_image) out.image_url = inputs.start_image;
    if (typeof config.num_inference_steps === "number") out.num_inference_steps = config.num_inference_steps;
    if (typeof config.seed === "number") out.seed = config.seed;
    return out;
  },
};

const fluxDevI2I: ModelSpec = {
  id: "fal-ai/flux/dev/image-to-image",
  provider: "fal",
  output: "image",
  label: "Flux Dev · img2img",
  description: "Image-to-image with prompt guidance + strength",
  inputs: [
    { name: "prompt", type: "text",  required: true },
    { name: "image",  type: "image", required: true, label: "source image" },
  ],
  config: [
    { name: "strength",           type: "number", min: 0,  max: 1,  step: 0.05, default: 0.85 },
    { name: "num_inference_steps", type: "number", min: 4, max: 50, step: 1,    default: 28 },
    { name: "guidance_scale",     type: "number", min: 1,  max: 10, step: 0.1,  default: 3.5 },
    { name: "seed",               type: "number", min: 0,  max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = {
      prompt: inputs.prompt,
      image_url: inputs.image,
    };
    for (const k of ["strength", "num_inference_steps", "guidance_scale", "seed"]) {
      const v = config[k];
      if (v !== null && v !== undefined && v !== "") out[k] = v;
    }
    return out;
  },
};

const fluxRedux: ModelSpec = {
  id: "fal-ai/flux/dev/redux",
  provider: "fal",
  output: "image",
  label: "Flux Dev · redux (style ref)",
  description: "Style/variation transfer — uses image as visual prompt",
  inputs: [
    { name: "image",  type: "image", required: true, label: "style ref" },
    { name: "prompt", type: "text",  required: false, label: "prompt (optional)" },
  ],
  config: [
    { name: "image_size",          type: "enum",   options: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], default: "square_hd" },
    { name: "num_inference_steps", type: "number", min: 4, max: 50, step: 1, default: 28 },
    { name: "seed",                type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { image_url: inputs.image };
    if (inputs.prompt) out.prompt = inputs.prompt;
    if (config.image_size) out.image_size = config.image_size;
    if (typeof config.num_inference_steps === "number") out.num_inference_steps = config.num_inference_steps;
    if (typeof config.seed === "number") out.seed = config.seed;
    return out;
  },
};

const fluxProUltra: ModelSpec = {
  id: "fal-ai/flux-pro/v1.1-ultra",
  provider: "fal",
  output: "image",
  label: "Flux Pro 1.1 Ultra",
  description: "High-quality generation with optional style reference",
  inputs: [
    { name: "prompt",       type: "text",  required: true },
    { name: "image",        type: "image", required: false, label: "style ref (optional)" },
  ],
  config: [
    { name: "aspect_ratio",   type: "enum",   options: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "9:21"], default: "16:9" },
    { name: "raw",            type: "bool",   default: false },
    { name: "image_prompt_strength", type: "number", min: 0, max: 1, step: 0.05, default: 0.1 },
    { name: "seed",           type: "number", min: 0, max: 2_147_483_647, step: 1, default: null },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = { prompt: inputs.prompt };
    if (inputs.image) {
      out.image_prompt = inputs.image;
      if (typeof config.image_prompt_strength === "number") {
        out.image_prompt_strength = config.image_prompt_strength;
      }
    }
    if (config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
    if (config.raw) out.raw = true;
    if (typeof config.seed === "number") out.seed = config.seed;
    return out;
  },
};

export const FAL_SPECS: ModelSpec[] = [
  fluxSchnell,
  fluxDev,
  fluxDevI2I,
  fluxRedux,
  fluxProUltra,
  seedancePro,
  seedanceLite,
  klingI2V,
  ltxVideo,
];
