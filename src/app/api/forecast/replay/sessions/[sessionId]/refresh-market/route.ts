import { NextResponse } from "next/server";
import { refreshPolymarketMarketForSession } from "@/lib/forecasting/polymarket/resolveFromPolymarketMarket";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const result = await refreshPolymarketMarketForSession(sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
