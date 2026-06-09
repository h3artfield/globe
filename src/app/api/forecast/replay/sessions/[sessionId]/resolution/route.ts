import { NextResponse } from "next/server";
import { getReplayResolution, resolveReplaySession } from "@/lib/forecasting/resolveReplaySession";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const resolution = await getReplayResolution(sessionId);
  if (!resolution) {
    return NextResponse.json(
      { error: "missing_evidence", message: `No resolution for session ${sessionId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(resolution);
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const resolution = await resolveReplaySession(sessionId);
    return NextResponse.json(resolution);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
