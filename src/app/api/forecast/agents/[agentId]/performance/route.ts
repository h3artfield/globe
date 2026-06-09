import { NextResponse } from "next/server";
import {
  getAgentPerformance,
  recomputeAgentPerformance,
} from "@/lib/forecasting/recomputeAgentPerformance";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  try {
    const performance = await getAgentPerformance(agentId);
    return NextResponse.json(performance);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
