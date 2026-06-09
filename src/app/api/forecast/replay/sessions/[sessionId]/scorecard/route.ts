import { NextResponse } from "next/server";
import { getReplayScorecard } from "@/lib/forecasting/scoreReplaySession";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const scorecard = await getReplayScorecard(sessionId);
  if (!scorecard) {
    return NextResponse.json(
      { error: "missing_scorecard", message: `No scorecard for session ${sessionId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(scorecard);
}
