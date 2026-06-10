import { NextResponse } from "next/server";
import type { PolymarketRefreshRequest } from "@/types/forecasting";
import { isPolymarketLiveFetchAllowed } from "@/lib/forecasting/polymarket/polymarketConfig";
import { refreshPolymarketQuestions } from "@/lib/forecasting/polymarket/refreshPolymarketMarket";

export async function POST(request: Request) {
  let body: PolymarketRefreshRequest = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as PolymarketRefreshRequest;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wantsLive = body.use_mock === false;
  if (wantsLive && !isPolymarketLiveFetchAllowed()) {
    return NextResponse.json(
      {
        error:
          "Live Polymarket fetch disabled. Set POLYMARKET_ALLOW_LIVE_FETCH=true or use mock refresh.",
      },
      { status: 403 },
    );
  }

  const result = await refreshPolymarketQuestions(body);
  return NextResponse.json(result);
}
