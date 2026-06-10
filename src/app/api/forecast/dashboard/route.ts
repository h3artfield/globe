import { NextResponse } from "next/server";
import { buildForecastDashboard } from "@/lib/forecasting/buildForecastDashboard";

export async function GET() {
  const dashboard = await buildForecastDashboard();
  return NextResponse.json(dashboard);
}
