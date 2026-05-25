export type ProviderId = "fal" | "replicate" | "openai";

export type Stage = "image" | "edit" | "video" | "chat";

export type GenerationResult = {
  url: string;
  mediaType: "image" | "video";
  meta?: Record<string, unknown>;
};

export type MediaRunnerArgs = {
  modelId: string;
  payload: Record<string, unknown>;
  apiKey: string;
  signal?: AbortSignal;
};

export type MediaRunner = (args: MediaRunnerArgs) => Promise<GenerationResult>;

export type ChatRunnerArgs = MediaRunnerArgs;
export type ChatRunner = (args: ChatRunnerArgs) => Promise<string>;

export type ProviderAdapter = {
  id: ProviderId;
  name: string;
  runMedia?: MediaRunner;
  runChat?: ChatRunner;
};

export class ProviderError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status = 500, body?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.body = body;
  }
}
