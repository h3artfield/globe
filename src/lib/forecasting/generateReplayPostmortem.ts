import type {
  ReplayEvidenceSnapshot,
  ReplayPostmortem,
  ReplayResolution,
  ReplayScorecard,
  ReplaySession,
} from "@/types/forecasting";
import { loadReplayEvidenceSnapshot } from "@/lib/forecasting/replayEvidenceSnapshotStore";
import { loadReplayResolution } from "@/lib/forecasting/replayResolutionStore";
import {
  createPostmortemId,
  loadReplayPostmortem,
  saveReplayPostmortem,
} from "@/lib/forecasting/replayPostmortemStore";
import { extractPostmortemRules } from "@/lib/forecasting/extractPostmortemRules";
import { loadForecastAgent, saveForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function appendAudit(session: ReplaySession, action: string, details?: string): ReplaySession {
  return {
    ...session,
    audit_trail: [
      ...session.audit_trail,
      { at: new Date().toISOString(), action, details },
    ],
  };
}

function buildForecastSummary(session: ReplaySession): string {
  const probability = session.user_forecast.probability ?? "unset";
  const confidence = session.user_forecast.confidence ?? "unset";
  return `Forecast p=${probability}% (${confidence} confidence). Rationale: ${session.user_forecast.rationale || "(none)"}`;
}

function buildResolutionSummary(resolution: ReplayResolution | null): string {
  if (!resolution) {
    return "No resolution recorded.";
  }
  return `Outcome=${resolution.outcome}; prior=${resolution.prior_value ?? "n/a"}; comparison=${resolution.comparison_value ?? "n/a"}; confidence=${resolution.confidence}.`;
}

function buildScoreSummary(scorecard: ReplayScorecard): string {
  if (scorecard.brier_score === null) {
    return `Scoring incomplete: ${scorecard.scoring_notes}`;
  }
  return `Brier=${scorecard.brier_score.toFixed(4)}; direction_correct=${scorecard.direction_correct}; ${scorecard.scoring_notes}`;
}

function buildWhatWentRight(
  scorecard: ReplayScorecard,
  resolution: ReplayResolution | null,
): string[] {
  const items: string[] = [];
  if (scorecard.direction_correct === true) {
    items.push("Forecast leaned the correct direction relative to the resolved outcome.");
  }
  if (scorecard.brier_score !== null && scorecard.brier_score <= 0.15) {
    items.push("Brier score indicates a reasonably calibrated probability for this outcome.");
  }
  if (resolution?.confidence === "high") {
    items.push("Resolution was backed by high-confidence local source data.");
  }
  if (items.length === 0) {
    items.push("No strong positives identified; treat this as a learning replay.");
  }
  return items;
}

function buildWhatWentWrong(
  scorecard: ReplayScorecard,
  resolution: ReplayResolution | null,
  snapshot: ReplayEvidenceSnapshot | null,
): string[] {
  const items: string[] = [];
  if (scorecard.direction_correct === false) {
    items.push("Forecast direction disagreed with the resolved outcome.");
  }
  if (scorecard.brier_score !== null && scorecard.brier_score > 0.25) {
    items.push("Brier score suggests poor calibration for this forecast.");
  }
  if (resolution?.outcome === "missing_evidence") {
    items.push("Resolution could not be fully determined from local data.");
  }
  if (snapshot && snapshot.included_records.length === 0) {
    items.push("Evidence snapshot was empty at the as_of cutoff.");
  }
  if (items.length === 0) {
    items.push("No major mistakes flagged; review rationale and source coverage anyway.");
  }
  return items;
}

function buildMissedSignals(snapshot: ReplayEvidenceSnapshot | null): string[] {
  if (!snapshot) {
    return ["No evidence snapshot was generated before scoring."];
  }
  if (snapshot.missing_sources.length > 0) {
    return [`Allowed sources missing locally: ${snapshot.missing_sources.join(", ")}.`];
  }
  return ["Review included evidence records for trends not cited in your rationale."];
}

function buildSourceLimitations(
  snapshot: ReplayEvidenceSnapshot | null,
  resolution: ReplayResolution | null,
): string[] {
  const items: string[] = [];
  if (snapshot?.limitations) {
    items.push(snapshot.limitations);
  }
  if (resolution?.limitations) {
    items.push(resolution.limitations);
  }
  if (items.length === 0) {
    items.push("No explicit source limitations recorded.");
  }
  return items;
}

function buildNextTimeRules(
  scorecard: ReplayScorecard,
  snapshot: ReplayEvidenceSnapshot | null,
): string[] {
  const rules = [
    "Generate an evidence snapshot before locking when local structured data exists.",
    "Only use records at or before the as_of year when forming your forecast rationale.",
  ];
  if (scorecard.direction_correct === false) {
    rules.push("Re-check baseline vs holdout direction in the resolution spec before assigning probability.");
  }
  if (snapshot && snapshot.confidence === "low") {
    rules.push("Flag low-confidence evidence explicitly in rationale when source coverage is sparse.");
  }
  return rules;
}

export async function generateReplayPostmortem(sessionId: string): Promise<ReplayPostmortem> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  const scorecard = await loadReplayScorecard(sessionId);
  if (!scorecard) {
    throw new ReplaySessionValidationError("Scorecard required before postmortem generation");
  }

  const existingPostmortem = await loadReplayPostmortem(sessionId);
  if (existingPostmortem) {
    return existingPostmortem;
  }

  const [resolution, snapshot] = await Promise.all([
    loadReplayResolution(sessionId),
    loadReplayEvidenceSnapshot(sessionId),
  ]);

  const postmortem: ReplayPostmortem = {
    postmortem_id: createPostmortemId(),
    session_id: session.session_id,
    created_at: new Date().toISOString(),
    question_text: session.question_text,
    forecast_summary: buildForecastSummary(session),
    resolution_summary: buildResolutionSummary(resolution),
    score_summary: buildScoreSummary(scorecard),
    what_went_right: buildWhatWentRight(scorecard, resolution),
    what_went_wrong: buildWhatWentWrong(scorecard, resolution, snapshot),
    missed_signals: buildMissedSignals(snapshot),
    source_limitations: buildSourceLimitations(snapshot, resolution),
    next_time_rules: buildNextTimeRules(scorecard, snapshot),
  };

  await saveReplayPostmortem(postmortem);

  const extractedRules = await extractPostmortemRules(session, postmortem);
  const ruleIds = extractedRules.map((rule) => rule.rule_id);

  if (session.agent_id) {
    const agent = await loadForecastAgent(session.agent_id);
    if (agent) {
      await saveForecastAgent({
        ...agent,
        next_time_rules: [
          ...new Set([...agent.next_time_rules, ...extractedRules.map((rule) => rule.rule_text)]),
        ],
      });
    }
  }

  const updated = appendAudit(
    {
      ...session,
      postmortem_id: postmortem.postmortem_id,
      postmortem_rule_ids: [...new Set([...session.postmortem_rule_ids, ...ruleIds])],
    },
    "postmortem_generated",
    `${postmortem.postmortem_id}; rules=${ruleIds.length}`,
  );
  await saveReplaySession(updated);

  return postmortem;
}

export async function getReplayPostmortem(sessionId: string): Promise<ReplayPostmortem | null> {
  const { loadReplayPostmortem } = await import("@/lib/forecasting/replayPostmortemStore");
  return loadReplayPostmortem(sessionId);
}
