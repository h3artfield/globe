import type { LeaderboardEntry, LeaderboardResponse } from "@/types/forecasting";
import { listForecastAgents } from "@/lib/forecasting/forecastAgentStore";
import { loadReplayJudgeAudit } from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { listReplaySessions } from "@/lib/forecasting/replaySessionStore";
import { listAllSourceRequests } from "@/lib/forecasting/sourceRequestStore";

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function buildLeaderboard(): Promise<LeaderboardResponse> {
  const agents = await listForecastAgents();
  const sessions = await listReplaySessions();
  const sourceRequests = await listAllSourceRequests();
  const entries: LeaderboardEntry[] = [];

  for (const agent of agents) {
    const agentSessions = sessions.filter((session) => session.agent_id === agent.agent_id);
    const resolvedSessions = agentSessions.filter((session) => session.status === "resolved");

    const brierScores: number[] = [];
    const directionResults: boolean[] = [];
    const templateBriers = new Map<string, number[]>();
    const gapCounts = new Map<string, number>();
    const warningCounts = new Map<string, number>();

    for (const session of resolvedSessions) {
      const scorecard = await loadReplayScorecard(session.session_id);
      const audit = await loadReplayJudgeAudit(session.session_id);

      if (scorecard?.brier_score != null) {
        brierScores.push(scorecard.brier_score);
        const bucket = templateBriers.get(session.template_id) ?? [];
        bucket.push(scorecard.brier_score);
        templateBriers.set(session.template_id, bucket);
      }
      if (scorecard?.direction_correct != null) {
        directionResults.push(scorecard.direction_correct);
      }

      for (const sourceId of session.requested_sources) {
        gapCounts.set(sourceId, (gapCounts.get(sourceId) ?? 0) + 1);
      }

      if (audit) {
        for (const warning of audit.warnings) {
          warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
        }
      }
    }

    const templateRanking = [...templateBriers.entries()]
      .map(([templateId, scores]) => ({
        templateId,
        avg: average(scores) ?? 999,
      }))
      .sort((left, right) => left.avg - right.avg);

    const fulfilledCount = sourceRequests.filter(
      (request) => request.agent_id === agent.agent_id && request.status === "fulfilled",
    ).length;

    const sortedBriers = resolvedSessions
      .map((session) => ({ session, at: session.created_at }))
      .sort((left, right) => left.at.localeCompare(right.at));
    let improvementTrend: string | null = null;
    if (sortedBriers.length >= 4) {
      const mid = Math.floor(sortedBriers.length / 2);
      const early: number[] = [];
      const late: number[] = [];
      for (let index = 0; index < sortedBriers.length; index += 1) {
        const scorecard = await loadReplayScorecard(sortedBriers[index]!.session.session_id);
        if (scorecard?.brier_score == null) {
          continue;
        }
        if (index < mid) {
          early.push(scorecard.brier_score);
        } else {
          late.push(scorecard.brier_score);
        }
      }
      const earlyAvg = average(early);
      const lateAvg = average(late);
      if (earlyAvg != null && lateAvg != null) {
        improvementTrend =
          lateAvg < earlyAvg
            ? "improving (lower recent Brier)"
            : lateAvg > earlyAvg
              ? "declining (higher recent Brier)"
              : "stable";
      }
    }

    entries.push({
      agent_id: agent.agent_id,
      agent_name: agent.name,
      agent_type: agent.type,
      total_forecasts: agentSessions.length,
      resolved_forecasts: resolvedSessions.length,
      average_brier_score: average(brierScores),
      direction_accuracy:
        directionResults.length > 0
          ? directionResults.filter(Boolean).length / directionResults.length
          : null,
      best_templates: templateRanking.slice(0, 3).map((item) => item.templateId),
      worst_templates: templateRanking
        .slice(-3)
        .reverse()
        .map((item) => item.templateId),
      common_source_gaps: [...gapCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([sourceId]) => sourceId),
      common_judge_warnings: [...warningCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([warning]) => warning),
      fulfilled_source_requests: fulfilledCount,
      improvement_trend: improvementTrend,
    });
  }

  entries.sort((left, right) => {
    const leftScore = left.average_brier_score ?? 999;
    const rightScore = right.average_brier_score ?? 999;
    return leftScore - rightScore;
  });

  return {
    entries,
    computed_at: new Date().toISOString(),
  };
}
