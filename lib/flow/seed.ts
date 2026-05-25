import type { Edge, Node } from "@xyflow/react";
import { STYLE_DEFAULTS } from "@/lib/style";
import { readPicksSync } from "@/lib/keys";
import { getSpec } from "@/lib/models/registry";
import { defaultParams } from "@/lib/models/types";
import { DEFAULT_PROMPT_CONTEXT } from "./types";

export function seedGraph(): { nodes: Node[]; edges: Edge[] } {
  const picks = readPicksSync();
  const chatSpec = getSpec(picks.chat.provider, picks.chat.model);
  const imageSpec = getSpec(picks.image.provider, picks.image.model);

  const nodes: Node[] = [
    {
      id: "text-1",
      type: "text",
      position: { x: 40, y: 80 },
      data: { config: { kind: "text", text: "a quiet forest at golden hour" }, status: "idle" },
    },
    {
      id: "prompt-1",
      type: "prompt",
      position: { x: 320, y: 40 },
      data: {
        config: {
          kind: "prompt",
          context: DEFAULT_PROMPT_CONTEXT,
          provider: picks.chat.provider,
          model: picks.chat.model,
          params: chatSpec ? defaultParams(chatSpec) : {},
        },
        status: "idle",
      },
    },
    {
      id: "imageGen-1",
      type: "imageGen",
      position: { x: 680, y: 40 },
      data: {
        config: {
          kind: "imageGen",
          provider: picks.image.provider,
          model: picks.image.model,
          params: imageSpec ? defaultParams(imageSpec) : {},
        },
        status: "idle",
      },
    },
    {
      id: "ascii-1",
      type: "ascii",
      position: { x: 1020, y: 40 },
      data: { config: { kind: "ascii", style: { ...STYLE_DEFAULTS } }, status: "idle" },
    },
    {
      id: "upload-1",
      type: "upload",
      position: { x: 40, y: 380 },
      data: {
        config: { kind: "upload", url: "/sample.mp4", mediaType: "video", label: "sample.mp4" },
        status: "done",
        output: { media: { url: "/sample.mp4", mediaType: "video" } },
      },
    },
  ];

  const edges: Edge[] = [
    { id: "e1", source: "text-1",     sourceHandle: "text",  target: "prompt-1",   targetHandle: "text",   animated: true },
    { id: "e2", source: "prompt-1",   sourceHandle: "text",  target: "imageGen-1", targetHandle: "prompt", animated: true },
    { id: "e3", source: "imageGen-1", sourceHandle: "media", target: "ascii-1",    targetHandle: "media",  animated: true },
  ];

  return { nodes, edges };
}
