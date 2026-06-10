import { NextResponse } from "next/server";
import { scoreForecastTournament } from "@/lib/forecasting/runForecastTournament";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  try {
    const tournament = await scoreForecastTournament(tournamentId);
    return NextResponse.json(tournament);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tournament scoring failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
