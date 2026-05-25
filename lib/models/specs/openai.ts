import type { ModelSpec } from "../types";

const gptImage1: ModelSpec = {
  id: "gpt-image-1",
  provider: "openai",
  output: "image",
  label: "gpt-image-1",
  description: "OpenAI image generation",
  inputs: [{ name: "prompt", type: "text", required: true }],
  config: [
    { name: "size", type: "enum", options: ["1024x1024", "1024x1536", "1536x1024"], default: "1024x1024" },
    { name: "quality", type: "enum", options: ["low", "medium", "high", "auto"], default: "auto" },
  ],
  buildPayload: ({ inputs, config }) => ({
    prompt: inputs.prompt,
    size: config.size,
    quality: config.quality,
    n: 1,
  }),
};

const gptImage1Edit: ModelSpec = {
  id: "gpt-image-1:edit",
  provider: "openai",
  output: "image",
  label: "gpt-image-1 · edit",
  description: "OpenAI image edit (text + image in)",
  inputs: [
    { name: "prompt", type: "text", required: true },
    { name: "image", type: "image", required: true },
  ],
  config: [
    { name: "size", type: "enum", options: ["1024x1024", "1024x1536", "1536x1024"], default: "1024x1024" },
  ],
  buildPayload: ({ inputs, config }) => ({
    prompt: inputs.prompt,
    image: inputs.image,
    size: config.size,
    // The openai edit endpoint uses multipart — the adapter unpacks `image` as a file.
  }),
};

function chatSpec(modelId: string, label: string, vision: boolean): ModelSpec {
  return {
    id: modelId,
    provider: "openai",
    output: "text",
    label,
    description: vision ? "Chat with vision input" : "Chat",
    inputs: [
      { name: "text", type: "text", required: true, label: "raw text" },
      ...(vision ? [{ name: "image" as const, type: "image" as const, required: false, label: "image (optional)" }] : []),
    ],
    config: [
      { name: "system", type: "text", default: "", placeholder: "system prompt (overrides node context if set)" },
      { name: "temperature", type: "number", min: 0, max: 2, step: 0.05, default: 0.7 },
      { name: "max_tokens", type: "number", min: 16, max: 4096, step: 16, default: 512 },
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
        max_tokens: config.max_tokens,
      };
    },
  };
}

export const OPENAI_SPECS: ModelSpec[] = [
  gptImage1,
  gptImage1Edit,
  chatSpec("gpt-4o-mini", "gpt-4o-mini", true),
  chatSpec("gpt-4o", "gpt-4o", true),
  chatSpec("gpt-4.1-mini", "gpt-4.1-mini", true),
  chatSpec("gpt-4.1", "gpt-4.1", true),
];
