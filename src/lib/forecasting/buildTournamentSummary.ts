import type { ForecastTournament, TournamentSummary } from "@/types/forecasting";
import { listAgentRunsForSession } from "@/lib/forecasting/agentRunStore";
import { loadReplayJudgeAudit } from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export async function buildTournamentSummary(
  tournament: ForecastTournament,
): Promise<TournamentSummary> {
  const summary: TournamentSummary = {
    total_sessions: tournament.session_ids.length,
    completed_sessions: 0,
    failed_sessions: tournament.summary.session_errors.length,
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
    strategy_tuning_suggestions: tournament.summary.strategy_tuning_suggestions,
    session_errors: tournament.summary.session_errors,
  };

  const brierByAgent = new Map<string, number[]>();
  const directionByAgent = new Map<string, number[]>();
  const brierByTemplate = new Map<string, number[]>();
  const brierByStrategy = new Map<string, number[]>();
  const sourceGapCounts: Record<string, number> = {};
  const judgeWarningCounts: Record<string, number> = {};

  for (const sessionId of tournament.session_ids) {
    const session = await loadReplaySession(sessionId);
    if (!session) {
      continue;
    }
    if (session.status === "locked" || session.status === "resolved") {
      summary.locked_sessions += 1;
    }
    if (session.status === "resolved") {
      summary.resolved_sessions += 1;
      summary.completed_sessions += 1;
    }

    const runs = await listAgentRunsForSession(sessionId);
    const latestRun = runs[0];
    if (latestRun?.status === "needs_sources") {
      summary.needs_sources_sessions += 1;
    } else if (latestRun?.status === "completed") {
      summary.completed_sessions += 1;
    }

    const strategyId = latestRun?.strategy_id ?? "unknown";
    const scorecard = await loadReplayScorecard(sessionId);
    if (scorecard?.brier_score != null && session.agent_id) {
      const agentScores = brierByAgent.get(session.agent_id) ?? [];
      agentScores.push(scorecard.brier_score);
      brierByAgent.set(session.agent_id, agentScores);

      const templateScores = brierByTemplate.get(session.template_id) ?? [];
      templateScores.push(scorecard.brier_score);
      brierByTemplate.set(session.template_id, templateScores);

      const strategyScores = brierByStrategy.get(strategyId) ?? [];
      strategyScores.push(scorecard.brier_score);
      brierByStrategy.set(strategyId, strategyScores);

      if (scorecard.direction_correct != null && session.agent_id) {
        const directions = directionByAgent.get(session.agent_id) ?? [];
        directions.push(scorecard.direction_correct ? 1 : 0);
        directionByAgent.set(session.agent_id, directions);
      }
    }

    const requests = await listSourceRequestsForSession(sessionId);
    for (const request of requests) {
      if (request.status === "open") {
        increment(sourceGapCounts, request.requested_source_id);
      }
    }

    const audit = await loadReplayJudgeAudit(sessionId);
    for (const warning of audit?.warnings ?? []) {
      increment(judgeWarningCounts, warning);
    }
  }

  for (const [agentId, scores] of brierByAgent) {
    summary.average_brier_by_agent[agentId] = average(scores);
  }
  for (const [agentId, values] of directionByAgent) {
    summary.direction_accuracy_by_agent[agentId] = average(values);
  }
  for (const [templateId, scores] of brierByTemplate) {
    summary.average_brier_by_template[templateId] = average(scores);
  }
  for (const [strategyId, scores] of brierByStrategy) {
    summary.average_brier_by_strategy[strategyId] = average(scores);
  }

  summary.common_source_gaps = Object.entries(sourceGapCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([sourceId, count]) => `${sourceId} (${count})`);

  summary.common_judge_warnings = Object.entries(judgeWarningCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([warning, count]) => `${warning} (${count})`);

  let bestStrategy: string | null = null;
  let worstStrategy: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let worstScore = Number.NEGATIVE_INFINITY;
  for (const [strategyId, score] of Object.entries(summary.average_brier_by_strategy)) {
    if (score == null) {
      continue;
    }
    if (score < bestScore) {
      bestScore = score;
      bestStrategy = strategyId;
    }
    if (score > worstScore) {
      worstScore = score;
      worstStrategy = strategyId;
    }
  }
  summary.best_performing_strategy = bestStrategy;
  summary.worst_performing_strategy = worstStrategy;

  return summary;
}
