import { NextResponse } from "next/server";
import { applyAgentRunToSession } from "@/lib/forecasting/runForecastAgent";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string; agentRunId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId, agentRunId } = await context.params;
  let body: { agent_id?: string };
  try {
    body = (await request.json()) as { agent_id?: string };
  } catch {
    body = {};
  }
  if (!body.agent_id?.trim()) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  try {
    const session = await applyAgentRunToSession(sessionId, agentRunId, body.agent_id.trim());
    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
