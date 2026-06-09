import { NextResponse } from "next/server";
import {
  buildReplayEvidenceSnapshot,
  getReplayEvidenceSnapshot,
} from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const snapshot = await getReplayEvidenceSnapshot(sessionId);
  if (!snapshot) {
    return NextResponse.json(
      { error: "missing_evidence", message: `No evidence snapshot for session ${sessionId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(snapshot);
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const snapshot = await buildReplayEvidenceSnapshot(sessionId);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
