import { NextResponse } from "next/server";
import { listAgentRunsForSession } from "@/lib/forecasting/agentRunStore";
import { runForecastAgent } from "@/lib/forecasting/runForecastAgent";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import type { RunForecastAgentRequest } from "@/types/forecasting";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const runs = await listAgentRunsForSession(sessionId);
  return NextResponse.json({ runs, count: runs.length });
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  let body: RunForecastAgentRequest;
  try {
    body = (await request.json()) as RunForecastAgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.strategy_id?.trim()) {
    return NextResponse.json({ error: "strategy_id is required" }, { status: 400 });
  }

  try {
    const run = await runForecastAgent(sessionId, body.strategy_id.trim(), body.agent_id);
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
