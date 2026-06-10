import { NextResponse } from "next/server";
import { planSourceRequestsFromAssessment } from "@/lib/forecasting/evidence/planSourceRequestsFromAssessment";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const result = await planSourceRequestsFromAssessment(sessionId);
    return NextResponse.json({
      created_count: result.created.length,
      reused_count: result.reused.length,
      skipped_count: result.skipped.length,
      created: result.created,
      reused: result.reused,
      skipped: result.skipped,
    });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
