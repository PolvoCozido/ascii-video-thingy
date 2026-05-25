"use client";

import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { getSpec } from "@/lib/models/registry";
import { defaultParams } from "@/lib/models/types";
import type { ProviderId } from "@/lib/providers/types";
import type { NodeConfig, NodeData } from "./types";

/**
 * Hook for model-driven nodes. Returns a function that updates this node's provider/model,
 * resets params to the new spec's defaults, and prunes any incoming edges whose target handle
 * is no longer present on the new model's input set.
 */
export function useModelChange(nodeId: string) {
  const { setNodes, setEdges } = useReactFlow();

  return useCallback(
    (provider: ProviderId, model: string) => {
      const spec = getSpec(provider, model);
      const params = spec ? defaultParams(spec) : {};
      const allowedInputNames = new Set(spec ? spec.inputs.map((i) => i.name) : []);

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const d = n.data as unknown as NodeData;
          const cfg = d.config as Extract<NodeConfig, { provider: ProviderId; model: string }>;
          return {
            ...n,
            data: {
              ...d,
              config: {
                ...cfg,
                provider,
                model,
                params,
              },
              // Old output likely doesn't match new model output shape — reset.
              status: "idle",
              error: undefined,
              output: undefined,
            } as unknown as Record<string, unknown>,
          };
        }),
      );

      // prune edges whose targetHandle no longer exists on this node
      setEdges((prev) =>
        prev.filter((e) => {
          if (e.target !== nodeId) return true;
          if (!e.targetHandle) return true;
          return allowedInputNames.has(e.targetHandle);
        }),
      );
    },
    [nodeId, setNodes, setEdges],
  );
}
