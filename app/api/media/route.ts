import { dispatchMedia } from "@/lib/server/dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  return dispatchMedia(req);
}
