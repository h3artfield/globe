import { NextResponse } from "next/server";
import { generateTuningProposalsForTournament } from "@/lib/forecasting/generateTuningProposals";
import { listTuningProposalsForTournament } from "@/lib/forecasting/tuningProposalStore";
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
  const proposals = await listTuningProposalsForTournament(tournamentId);
  return NextResponse.json({ proposals });
}

export async function POST(_request: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: `Tournament not found: ${tournamentId}` }, { status: 404 });
  }
  const proposals = await generateTuningProposalsForTournament(tournament);
  return NextResponse.json({ proposals });
}
