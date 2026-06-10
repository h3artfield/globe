import { NextResponse } from "next/server";
import { attachNewsEvidenceToSession } from "@/lib/forecasting/gdelt/attachNewsEvidenceToSession";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const result = await attachNewsEvidenceToSession(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
