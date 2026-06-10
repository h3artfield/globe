import { NextResponse } from "next/server";
import {
  loadAgentStrategy,
  upsertAgentStrategy,
} from "@/lib/forecasting/agentStrategyStore";
import { loadForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { BUILTIN_AGENT_STRATEGIES } from "@/lib/forecasting/builtInAgentStrategies";
import type { CreateAgentStrategyRequest } from "@/types/forecasting";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await loadForecastAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
  }
  const saved = await loadAgentStrategy(agentId);
  return NextResponse.json({
    saved_strategy: saved,
    builtin_strategies: BUILTIN_AGENT_STRATEGIES,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const agent = await loadForecastAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: `Agent not found: ${agentId}` }, { status: 404 });
  }

  let body: CreateAgentStrategyRequest;
  try {
    body = (await request.json()) as CreateAgentStrategyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const strategy = await upsertAgentStrategy(agentId, body);
  return NextResponse.json(strategy);
}
