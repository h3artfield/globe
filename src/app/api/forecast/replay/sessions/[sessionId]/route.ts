import { NextResponse } from "next/server";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { updateReplaySessionDraft } from "@/lib/forecasting/updateReplaySession";
import type { UpdateReplaySessionDraftRequest } from "@/types/forecasting";

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

export async function PATCH(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  let body: UpdateReplaySessionDraftRequest;
  try {
    body = (await request.json()) as UpdateReplaySessionDraftRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const session = await updateReplaySessionDraft(sessionId, body);
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
