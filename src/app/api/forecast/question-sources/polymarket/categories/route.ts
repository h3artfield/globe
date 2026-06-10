import { NextResponse } from "next/server";
import { loadPolymarketSourceConfig } from "@/lib/forecasting/polymarket/polymarketConfig";

export async function GET() {
  const config = await loadPolymarketSourceConfig();
  return NextResponse.json({
    source: config.source,
    categories: config.categories,
  });
}
