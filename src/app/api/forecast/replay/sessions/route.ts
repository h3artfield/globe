import { NextResponse } from "next/server";
import { ReplaySessionValidationError } from "@/lib/forecasting/createReplaySession";
import { createReplaySession, listReplaySessions } from "@/lib/forecasting/replaySessionStore";
import type { CreateReplaySessionRequest, ReplaySessionListResponse } from "@/types/forecasting";

export async function GET() {
  const sessions = await listReplaySessions();
  const body: ReplaySessionListResponse = {
    sessions,
    count: sessions.length,
  };
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  let body: CreateReplaySessionRequest;
  try {
    body = (await request.json()) as CreateReplaySessionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.template_id || !body.target || body.year === undefined) {
    return NextResponse.json(
      { error: "template_id, target, and year are required" },
      { status: 400 },
    );
  }

  try {
    const session = await createReplaySession(body);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
