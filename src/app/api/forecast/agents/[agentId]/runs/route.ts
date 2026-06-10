import { NextResponse } from "next/server";
import { listAgentRuns } from "@/lib/forecasting/agentRunStore";
import { loadForecastAgent } from "@/lib/forecasting/forecastAgentStore";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await loadForecastAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
  }
  const runs = await listAgentRuns(agentId);
  return NextResponse.json({ runs, count: runs.length });
}
