import { NextResponse } from "next/server";
import { buildLeaderboard } from "@/lib/forecasting/buildLeaderboard";

export async function GET() {
  const leaderboard = await buildLeaderboard();
  return NextResponse.json(leaderboard);
}
