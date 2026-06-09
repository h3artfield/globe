import { NextResponse } from "next/server";
import {
  createForecastAgent,
  listForecastAgents,
} from "@/lib/forecasting/forecastAgentStore";
import type { CreateForecastAgentRequest, ForecastAgentListResponse } from "@/types/forecasting";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export async function GET() {
  const agents = await listForecastAgents();
  const body: ForecastAgentListResponse = {
    agents,
    count: agents.length,
  };
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  let body: CreateForecastAgentRequest;
  try {
    body = (await request.json()) as CreateForecastAgentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  try {
    const agent = await createForecastAgent(body);
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
