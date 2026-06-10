import { NextResponse } from "next/server";
import { assessAndSaveSessionEvidence } from "@/lib/forecasting/evidence/assessSessionEvidence";
import { loadSessionEvidenceAssessment } from "@/lib/forecasting/evidence/evidenceAssessmentStore";
import { getReplayEvidenceSnapshot } from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const assessment = await loadSessionEvidenceAssessment(sessionId);
  return NextResponse.json({ assessment });
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const session = await loadReplaySession(sessionId);
    if (!session) {
      return NextResponse.json({ error: `Session not found: ${sessionId}` }, { status: 404 });
    }
    if (session.status !== "draft" && session.status !== "locked") {
      throw new ReplaySessionValidationError(
        `Evidence assessment is only allowed on draft or locked sessions (status=${session.status})`,
      );
    }
    const snapshot = await getReplayEvidenceSnapshot(sessionId);
    const assessment = await assessAndSaveSessionEvidence(session, snapshot);
    return NextResponse.json({ assessment });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
