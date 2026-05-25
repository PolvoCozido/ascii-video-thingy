import type { ModelSpec } from "../types";

const grokImage: ModelSpec = {
  id: "grok-imagine-image-quality",
  provider: "xai",
  output: "image",
  label: "Grok Imagine · quality",
  description: "xAI image generation. Prompt only.",
  inputs: [{ name: "prompt", type: "text", required: true }],
  config: [
    { name: "aspect_ratio", type: "enum", options: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "auto"], default: "1:1" },
    { name: "resolution", type: "enum", options: ["1k", "2k"], default: "1k" },
    { name: "n", type: "number", min: 1, max: 10, step: 1, default: 1 },
  ],
  buildPayload: ({ inputs, config }) => {
    const out: Record<string, unknown> = {
      model: "grok-imagine-image-quality",
      prompt: inputs.prompt,
      n: config.n ?? 1,
    };
    // xAI image gen takes aspect_ratio + resolution (no size/quality params).
    if (config.aspect_ratio) out.aspect_ratio = config.aspect_ratio;
    if (config.resolution) out.resolution = config.resolution;
    return out;
  },
};

function grokChatSpec(modelId: string, label: string, vision: boolean): ModelSpec {
  return {
    id: modelId,
    provider: "xai",
    output: "text",
    label,
    description: vision ? "Grok chat with vision input" : "Grok chat",
    inputs: [
      { name: "text", type: "text", required: true, label: "raw text" },
      ...(vision ? [{ name: "image" as const, type: "image" as const, required: false, label: "image (optional)" }] : []),
    ],
    config: [
      { name: "system", type: "text", default: "", placeholder: "system prompt (overrides node context if set)" },
      { name: "temperature", type: "number", min: 0, max: 2, step: 0.05, default: 0.7 },
      // xAI deprecated `max_tokens` in favor of `max_completion_tokens`.
      { name: "max_completion_tokens", label: "max tokens", type: "number", min: 16, max: 16384, step: 16, default: 1024 },
    ],
    buildPayload: ({ inputs, config }) => {
      const userContent: Array<Record<string, unknown>> = [{ type: "text", text: inputs.text }];
      if (vision && inputs.image) {
        userContent.push({ type: "image_url", image_url: { url: inputs.image } });
      }
      const messages: Array<Record<string, unknown>> = [];
      const sys = (config.system as string) || "";
      if (sys) messages.push({ role: "system", content: sys });
      messages.push({ role: "user", content: userContent });
      return {
        model: modelId,
        messages,
        temperature: config.temperature,
        max_completion_tokens: config.max_completion_tokens,
      };
    },
  };
}

// grok-4 / grok-4-fast were retired May 15 2026 (now redirect to grok-4.3).
// grok-4.3 is the current default and the vision-capable model.
export const XAI_SPECS: ModelSpec[] = [
  grokImage,
  grokChatSpec("grok-4.3",                     "Grok 4.3",          true),
  grokChatSpec("grok-4.20-0309-non-reasoning", "Grok 4.20 (fast)",  false),
];
