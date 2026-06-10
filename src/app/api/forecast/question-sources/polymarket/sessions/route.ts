import { NextResponse } from "next/server";
import type { CreateForecastSessionFromPolymarketRequest } from "@/types/forecasting";
import { createForecastSessionFromPolymarketQuestion } from "@/lib/forecasting/polymarket/createForecastSessionFromPolymarketQuestion";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export async function POST(request: Request) {
  let body: CreateForecastSessionFromPolymarketRequest;
  try {
    body = (await request.json()) as CreateForecastSessionFromPolymarketRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.source_market_id?.trim()) {
    return NextResponse.json({ error: "source_market_id is required" }, { status: 400 });
  }

  try {
    const session = await createForecastSessionFromPolymarketQuestion(body);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
