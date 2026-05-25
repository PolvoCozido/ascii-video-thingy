"use client";

type Handler = (nodeId: string) => void;
let handler: Handler | null = null;

export function setRunFromNodeHandler(h: Handler | null): void {
  handler = h;
}

export function runFromNode(nodeId: string): void {
  handler?.(nodeId);
}
