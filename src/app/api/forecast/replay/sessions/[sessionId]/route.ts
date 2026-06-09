import { NextResponse } from "next/server";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const session = await loadReplaySession(sessionId);
  if (!session) {
    return NextResponse.json({ error: `Session not found: ${sessionId}` }, { status: 404 });
  }
  return NextResponse.json(session);
}
