import { dispatchChat } from "@/lib/server/dispatch";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  return dispatchChat(req);
}
