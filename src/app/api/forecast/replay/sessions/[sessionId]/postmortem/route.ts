import { NextResponse } from "next/server";
import {
  generateReplayPostmortem,
  getReplayPostmortem,
} from "@/lib/forecasting/generateReplayPostmortem";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const postmortem = await getReplayPostmortem(sessionId);
  if (!postmortem) {
    return NextResponse.json(
      { error: "missing_postmortem", message: `No postmortem for session ${sessionId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(postmortem);
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const postmortem = await generateReplayPostmortem(sessionId);
    return NextResponse.json(postmortem);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
