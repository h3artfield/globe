import path from "node:path";
import { randomBytes } from "node:crypto";
import type {
  CreateForecastTournamentRequest,
  ForecastTournament,
  TournamentRunConfig,
  TournamentSummary,
} from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const TOURNAMENTS_DIR = repoPath("data", "forecasting", "tournaments");

export const DEFAULT_TOURNAMENT_RUN_CONFIG: TournamentRunConfig = {
  require_evidence_snapshot: true,
  allow_auto_apply_agent_draft: true,
  allow_auto_lock: false,
  allow_auto_resolve_score_judge_postmortem: false,
  max_sessions: 50,
  source_request_policy: "create_requests_only",
};

function emptySummary(): TournamentSummary {
  return {
    total_sessions: 0,
    completed_sessions: 0,
    failed_sessions: 0,
    needs_sources_sessions: 0,
    locked_sessions: 0,
    resolved_sessions: 0,
    average_brier_by_agent: {},
    direction_accuracy_by_agent: {},
    average_brier_by_template: {},
    average_brier_by_strategy: {},
    common_source_gaps: [],
    common_judge_warnings: [],
    best_performing_strategy: null,
    worst_performing_strategy: null,
    recommended_strategy_changes: [],
    strategy_tuning_suggestions: [],
    session_errors: [],
  };
}

function tournamentFilePath(tournamentId: string): string {
  return path.join(TOURNAMENTS_DIR, tournamentId, "tournament.v1.json");
}

export function createTournamentId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `tournament_${stamp}_${suffix}`;
}

export async function saveTournament(tournament: ForecastTournament): Promise<void> {
  await writeJsonFile(tournamentFilePath(tournament.tournament_id), tournament);
}

export async function loadTournament(
  tournamentId: string,
): Promise<ForecastTournament | null> {
  const filePath = tournamentFilePath(tournamentId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastTournament>(filePath);
}

export async function listTournaments(): Promise<ForecastTournament[]> {
  const { readdir } = await import("node:fs/promises");
  let entries: string[] = [];
  try {
    entries = await readdir(TOURNAMENTS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const tournaments: ForecastTournament[] = [];
  for (const id of entries) {
    const tournament = await loadTournament(id);
    if (tournament) {
      tournaments.push(tournament);
    }
  }
  return tournaments.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createTournament(
  input: CreateForecastTournamentRequest,
): Promise<ForecastTournament> {
  const tournament: ForecastTournament = {
    tournament_id: createTournamentId(),
    created_at: new Date().toISOString(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    template_ids: input.template_ids,
    targets: input.targets.map((target) => target.trim().toUpperCase()),
    years: input.years,
    agent_ids: input.agent_ids,
    strategy_ids: input.strategy_ids,
    session_ids: [],
    status: "draft",
    run_count: 0,
    run_config: {
      ...DEFAULT_TOURNAMENT_RUN_CONFIG,
      ...input.run_config,
    },
    summary: emptySummary(),
    warnings: [],
    errors: [],
  };
  await saveTournament(tournament);
  return tournament;
}
