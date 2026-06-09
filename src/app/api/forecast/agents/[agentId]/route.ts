import { NextResponse } from "next/server";
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
  return NextResponse.json(agent);
}
