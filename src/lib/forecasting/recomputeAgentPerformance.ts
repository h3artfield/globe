import type {
  AgentCalibrationBucket,
  AgentPerformanceSummary,
  ForecastAgentProfile,
} from "@/types/forecasting";
import { loadForecastAgent, saveForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { loadReplayJudgeAudit } from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayPostmortem } from "@/lib/forecasting/replayPostmortemStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { listReplaySessions } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

const BUCKETS: AgentCalibrationBucket["bucket"][] = [
  "0-20",
  "21-40",
  "41-60",
  "61-80",
  "81-100",
];

function probabilityBucket(probability: number): AgentCalibrationBucket["bucket"] {
  if (probability <= 20) return "0-20";
  if (probability <= 40) return "21-40";
  if (probability <= 60) return "41-60";
  if (probability <= 80) return "61-80";
  return "81-100";
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sourceFamilyKey(allowedSourceIds: string[]): string {
  return allowedSourceIds.join("+") || "unknown";
}

export async function recomputeAgentPerformance(
  agentId: string,
): Promise<AgentPerformanceSummary> {
  const agent = await loadForecastAgent(agentId);
  if (!agent) {
    throw new ReplaySessionValidationError(`Agent not found: ${agentId}`);
  }

  const sessions = (await listReplaySessions()).filter((session) => session.agent_id === agentId);
  const resolvedSessions = sessions.filter((session) => session.status === "resolved");

  const brierScores: number[] = [];
  const directionResults: boolean[] = [];
  const bucketMap = new Map<AgentCalibrationBucket["bucket"], number[]>();
  for (const bucket of BUCKETS) {
    bucketMap.set(bucket, []);
  }

  const byTemplate: AgentPerformanceSummary["performance_by_template_id"] = {};
  const bySourceFamily: AgentPerformanceSummary["performance_by_source_family"] = {};
  const warningCounts = new Map<string, number>();
  const missedSignalCounts = new Map<string, number>();
  const ruleTexts = new Set<string>();

  for (const session of resolvedSessions) {
    const scorecard = await loadReplayScorecard(session.session_id);
    const postmortem = await loadReplayPostmortem(session.session_id);
    const audit = await loadReplayJudgeAudit(session.session_id);

    if (!byTemplate[session.template_id]) {
      byTemplate[session.template_id] = { count: 0, average_brier: null, direction_accuracy: null };
    }
    byTemplate[session.template_id].count += 1;

    const family = sourceFamilyKey(session.allowed_source_ids);
    if (!bySourceFamily[family]) {
      bySourceFamily[family] = { count: 0, average_brier: null };
    }
    bySourceFamily[family].count += 1;

    if (scorecard?.brier_score != null) {
      brierScores.push(scorecard.brier_score);
      bucketMap.get(probabilityBucket(scorecard.forecast_probability))?.push(scorecard.brier_score);
      byTemplate[session.template_id].average_brier = null;
      bySourceFamily[family].average_brier = null;
    }
    if (scorecard?.direction_correct != null) {
      directionResults.push(scorecard.direction_correct);
    }

    if (audit) {
      for (const warning of audit.warnings) {
        warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1);
      }
    }

    if (postmortem) {
      for (const signal of postmortem.missed_signals) {
        missedSignalCounts.set(signal, (missedSignalCounts.get(signal) ?? 0) + 1);
      }
      for (const rule of postmortem.next_time_rules) {
        ruleTexts.add(rule);
      }
    }

    for (const ruleId of session.postmortem_rule_ids) {
      ruleTexts.add(ruleId);
    }
  }

  for (const [templateId, stats] of Object.entries(byTemplate)) {
    const briersForTemplate: number[] = [];
    const directionsForTemplate: boolean[] = [];
    for (const session of resolvedSessions.filter((s) => s.template_id === templateId)) {
      const scorecard = await loadReplayScorecard(session.session_id);
      if (scorecard?.brier_score != null) {
        briersForTemplate.push(scorecard.brier_score);
      }
      if (scorecard?.direction_correct != null) {
        directionsForTemplate.push(scorecard.direction_correct);
      }
    }
    stats.average_brier = average(briersForTemplate);
    stats.direction_accuracy =
      directionsForTemplate.length > 0
        ? directionsForTemplate.filter(Boolean).length / directionsForTemplate.length
        : null;
  }

  for (const [family, stats] of Object.entries(bySourceFamily)) {
    const briers: number[] = [];
    for (const session of resolvedSessions.filter(
      (s) => sourceFamilyKey(s.allowed_source_ids) === family,
    )) {
      const scorecard = await loadReplayScorecard(session.session_id);
      if (scorecard?.brier_score != null) {
        briers.push(scorecard.brier_score);
      }
    }
    stats.average_brier = average(briers);
  }

  const calibrationBuckets: AgentCalibrationBucket[] = BUCKETS.map((bucket) => ({
    bucket,
    count: bucketMap.get(bucket)?.length ?? 0,
    average_brier: average(bucketMap.get(bucket) ?? []),
  }));

  const commonJudgeWarnings = [...warningCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([message]) => message);

  const repeatedMissedSignals = [...missedSignalCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([message]) => message);

  const summary: AgentPerformanceSummary = {
    agent_id: agentId,
    computed_at: new Date().toISOString(),
    total_forecasts: sessions.length,
    resolved_forecasts: resolvedSessions.length,
    average_brier_score: average(brierScores),
    direction_accuracy:
      directionResults.length > 0
        ? directionResults.filter(Boolean).length / directionResults.length
        : null,
    calibration_buckets: calibrationBuckets,
    performance_by_template_id: byTemplate,
    performance_by_source_family: bySourceFamily,
    common_judge_warnings: commonJudgeWarnings,
    repeated_missed_signals: repeatedMissedSignals,
    recommended_next_time_rules: [...ruleTexts, ...agent.next_time_rules].slice(0, 20),
  };

  const updatedAgent: ForecastAgentProfile = {
    ...agent,
    calibration_summary:
      summary.average_brier_score != null
        ? `Avg Brier ${summary.average_brier_score.toFixed(4)} over ${summary.resolved_forecasts} resolved forecasts.`
        : "Insufficient resolved forecasts for calibration summary.",
    strengths:
      summary.direction_accuracy != null && summary.direction_accuracy >= 0.6
        ? ["Direction accuracy above 60% on resolved replays."]
        : agent.strengths,
    weaknesses:
      summary.average_brier_score != null && summary.average_brier_score > 0.25
        ? ["Brier scores suggest miscalibration on recent replays."]
        : agent.weaknesses,
    next_time_rules: summary.recommended_next_time_rules,
  };
  await saveForecastAgent(updatedAgent);

  return summary;
}

export async function getAgentPerformance(agentId: string): Promise<AgentPerformanceSummary> {
  return recomputeAgentPerformance(agentId);
}
