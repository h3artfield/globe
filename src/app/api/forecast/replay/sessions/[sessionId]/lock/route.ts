import { NextResponse } from "next/server";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import { lockReplaySession } from "@/lib/forecasting/updateReplaySession";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const session = await lockReplaySession(sessionId);
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
