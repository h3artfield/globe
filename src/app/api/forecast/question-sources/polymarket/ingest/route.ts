import { NextResponse } from "next/server";
import type { PolymarketIngestRequest } from "@/types/forecasting";
import { ingestPolymarketQuestions } from "@/lib/forecasting/polymarket/ingestPolymarketQuestions";
import { isPolymarketLiveFetchAllowed } from "@/lib/forecasting/polymarket/polymarketConfig";

export async function POST(request: Request) {
  let body: PolymarketIngestRequest = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as PolymarketIngestRequest;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wantsLive = body.use_mock === false;
  if (wantsLive && !isPolymarketLiveFetchAllowed()) {
    return NextResponse.json(
      {
        error:
          "Live Polymarket fetch disabled. Set POLYMARKET_ALLOW_LIVE_FETCH=true or use mock ingest.",
      },
      { status: 403 },
    );
  }

  const result = await ingestPolymarketQuestions(body);
  return NextResponse.json(result);
}
