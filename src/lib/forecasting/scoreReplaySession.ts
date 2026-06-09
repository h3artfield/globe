import type { ReplayScorecard, ReplaySession } from "@/types/forecasting";
import { loadReplayEvidenceSnapshot } from "@/lib/forecasting/replayEvidenceSnapshotStore";
import { loadReplayResolution } from "@/lib/forecasting/replayResolutionStore";
import {
  binaryOutcomeValue,
  collectSourcePaths,
  computeBrierScore,
  computeDirectionCorrect,
  scoringLimitationForOutcome,
} from "@/lib/forecasting/replay/replayScoring";
import {
  createScorecardId,
  loadReplayScorecard,
  saveReplayScorecard,
} from "@/lib/forecasting/replayScorecardStore";
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

function assertScoringAllowed(session: ReplaySession): void {
  if (session.status === "draft") {
    throw new ReplaySessionValidationError("Cannot score draft session; resolve first");
  }
  if (session.status === "locked") {
    throw new ReplaySessionValidationError(
      "Cannot score locked-but-unresolved session; resolve first",
    );
  }
  if (session.status !== "resolved") {
    throw new ReplaySessionValidationError(`Cannot score session with status ${session.status}`);
  }
}

export async function scoreReplaySession(sessionId: string): Promise<ReplayScorecard> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  assertScoringAllowed(session);

  const resolution = await loadReplayResolution(sessionId);
  if (!resolution) {
    throw new ReplaySessionValidationError("Resolution required before scoring");
  }

  const snapshot = await loadReplayEvidenceSnapshot(sessionId);
  const probability = session.user_forecast.probability;
  if (probability === null) {
    throw new ReplaySessionValidationError("Locked forecast probability is required for scoring");
  }

  const outcomeBinary = binaryOutcomeValue(resolution.outcome);
  const scoringLimitation = scoringLimitationForOutcome(resolution.outcome);
  const sourcePaths = collectSourcePaths(
    resolution,
    snapshot?.source_paths ?? [],
  );

  let brierScore: number | null = null;
  let directionCorrect: boolean | null = null;
  let scoringNotes: string;
  const limitations: string[] = [];

  if (outcomeBinary === null) {
    brierScore = null;
    directionCorrect = null;
    scoringNotes = scoringLimitation ?? "Scoring not supported for this outcome.";
    limitations.push(scoringNotes);
  } else {
    brierScore = computeBrierScore(probability, outcomeBinary);
    directionCorrect = computeDirectionCorrect(probability, outcomeBinary);
    scoringNotes = `Brier=${brierScore.toFixed(4)}; direction_correct=${directionCorrect}; outcome=${resolution.outcome}`;
  }

  const scorecard: ReplayScorecard = {
    scorecard_id: createScorecardId(),
    session_id: session.session_id,
    template_id: session.template_id,
    created_at: new Date().toISOString(),
    forecast_probability: probability,
    outcome: resolution.outcome,
    brier_score: brierScore,
    direction_correct: directionCorrect,
    confidence: session.user_forecast.confidence,
    scoring_notes: scoringNotes,
    limitations: limitations.join(" ").trim(),
    source_paths: sourcePaths,
  };

  await saveReplayScorecard(scorecard);

  const updated = appendAudit(
    { ...session, scorecard_id: scorecard.scorecard_id },
    "session_scored",
    scoringNotes,
  );
  await saveReplaySession(updated);

  return scorecard;
}

export async function getReplayScorecard(sessionId: string): Promise<ReplayScorecard | null> {
  return loadReplayScorecard(sessionId);
}
