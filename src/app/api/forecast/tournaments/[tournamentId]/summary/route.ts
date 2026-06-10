import { NextResponse } from "next/server";
import { buildTournamentSummary } from "@/lib/forecasting/buildTournamentSummary";
import { loadTournament } from "@/lib/forecasting/tournamentStore";

type RouteContext = {
  params: Promise<{ tournamentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: `Tournament not found: ${tournamentId}` }, { status: 404 });
  }
  return NextResponse.json(tournament);
}

export async function POST(_request: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: `Tournament not found: ${tournamentId}` }, { status: 404 });
  }
  const summary = await buildTournamentSummary(tournament);
  return NextResponse.json({ tournament_id: tournamentId, summary });
}
