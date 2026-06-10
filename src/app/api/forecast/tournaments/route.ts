import { NextResponse } from "next/server";
import { createTournament, listTournaments } from "@/lib/forecasting/tournamentStore";
import type { CreateForecastTournamentRequest } from "@/types/forecasting";

export async function GET() {
  const tournaments = await listTournaments();
  return NextResponse.json({ tournaments, count: tournaments.length });
}

export async function POST(request: Request) {
  let body: CreateForecastTournamentRequest;
  try {
    body = (await request.json()) as CreateForecastTournamentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!body.template_ids?.length || !body.targets?.length || !body.years?.length) {
    return NextResponse.json(
      { error: "template_ids, targets, and years are required" },
      { status: 400 },
    );
  }
  if (!body.agent_ids?.length || !body.strategy_ids?.length) {
    return NextResponse.json({ error: "agent_ids and strategy_ids are required" }, { status: 400 });
  }

  const tournament = await createTournament(body);
  return NextResponse.json(tournament, { status: 201 });
}
