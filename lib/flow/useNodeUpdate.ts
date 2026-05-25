"use client";

import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import type { NodeConfig, NodeData } from "./types";

export function useNodeUpdate(nodeId: string) {
  const { setNodes } = useReactFlow();

  const update = useCallback(
    (patch: Partial<NodeConfig>) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const d = n.data as unknown as NodeData;
          return {
            ...n,
            data: {
              ...d,
              config: { ...d.config, ...(patch as Record<string, unknown>) } as NodeConfig,
            } as unknown as Record<string, unknown>,
          };
        }),
      );
    },
    [nodeId, setNodes],
  );

  return update;
}
