import type { StyleState } from "@/lib/style";
import type { ProviderId } from "@/lib/providers/types";

export type FlowNodeKind =
  | "text"
  | "prompt"
  | "upload"
  | "imageGen"
  | "videoGen"
  | "ascii"
  | "convert";

export type MediaValue = { url: string; mediaType: "image" | "video" };

export type RunStatus = "idle" | "running" | "done" | "error";

/**
 * For the model-driven kinds (prompt, imageGen, edit, videoGen), `provider` + `model`
 * identify a ModelSpec and `params` holds the user-set config values for that spec.
 * The system prompt for chat models lives in `context`.
 */
export type ModelDrivenConfig = {
  provider: ProviderId;
  model: string;
  params: Record<string, unknown>;
};

export type NodeConfig =
  | { kind: "text"; text: string }
  | ({ kind: "prompt"; context: string } & ModelDrivenConfig)
  | { kind: "upload"; url?: string; mediaType?: "image" | "video"; label?: string }
  | ({ kind: "imageGen" } & ModelDrivenConfig)
  | ({ kind: "videoGen" } & ModelDrivenConfig)
  | { kind: "ascii"; style: StyleState }
  | { kind: "convert" };

export type NodeData = {
  config: NodeConfig;
  status: RunStatus;
  output?: { text?: string; media?: MediaValue };
  error?: string;
};

/** Static IO for non-model-driven kinds. Model-driven kinds compute their IO from the spec. */
export const STATIC_IO: Partial<Record<FlowNodeKind, { inputs: string[]; outputs: string[] }>> = {
  text: { inputs: [], outputs: ["text"] },
  upload: { inputs: [], outputs: ["media"] },
  ascii: { inputs: ["media"], outputs: ["media"] },
  convert: { inputs: ["media"], outputs: ["media"] },
};

export const DEFAULT_LABEL: Record<FlowNodeKind, string> = {
  text: "text",
  prompt: "prompt",
  upload: "upload",
  imageGen: "image gen",
  videoGen: "video gen",
  ascii: "ascii",
  convert: "webm → mp4",
};

export const DEFAULT_PROMPT_CONTEXT = `You are a senior prompt engineer for text-to-image models.
Given a brief user idea (and optionally a reference image), write ONE rich, single-paragraph image prompt that renders the subject in this exact aesthetic:

Minimalist black void background, translucent holographic aesthetic, semi-transparent glowing subject, monochrome white and soft gray tones, ghostlike bioluminescent appearance, x-ray inspired rendering, subtle internal textures visible through the body, cinematic high contrast lighting, futuristic deep-sea hologram style, soft volumetric glow, ethereal and elegant, realistic anatomy with stylized translucency, isolated subject floating in darkness, ultra clean composition, mysterious sci-fi biological scan aesthetic, no environment, no particles, no text.

Weave the user's subject through every clause of that spec — describe its anatomy, internal textures, glow, and silhouette in those terms. Be concrete and visual about lighting cues, materiality, and lens. Do not introduce environments, particles, or text. No quotes, no preamble, no bullet points. Output only the prompt.`;

export function isModelDrivenKind(kind: FlowNodeKind): kind is "prompt" | "imageGen" | "videoGen" {
  return kind === "prompt" || kind === "imageGen" || kind === "videoGen";
}
