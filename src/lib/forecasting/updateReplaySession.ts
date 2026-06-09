import type { ReplaySession, UpdateReplaySessionDraftRequest } from "@/types/forecasting";
import {
  assertSessionEditable,
  ReplaySessionValidationError,
  validateConfidence,
  validateProbability,
} from "@/lib/forecasting/replaySessionValidation";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";

function appendAudit(
  session: ReplaySession,
  action: string,
  details?: string,
): ReplaySession {
  return {
    ...session,
    audit_trail: [
      ...session.audit_trail,
      {
        at: new Date().toISOString(),
        action,
        details,
      },
    ],
  };
}

export async function updateReplaySessionDraft(
  sessionId: string,
  input: UpdateReplaySessionDraftRequest,
): Promise<ReplaySession> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  assertSessionEditable(session.status);

  const nextRationale =
    input.forecast_rationale !== undefined
      ? input.forecast_rationale
      : input.rationale !== undefined
        ? input.rationale
        : session.user_forecast.rationale;

  const nextForecast = {
    probability:
      input.probability !== undefined
        ? validateProbability(input.probability)
        : session.user_forecast.probability,
    confidence:
      input.confidence !== undefined
        ? validateConfidence(input.confidence)
        : session.user_forecast.confidence,
    rationale: nextRationale,
  };

  const updated = appendAudit(
    {
      ...session,
      user_forecast: nextForecast,
      forecast_rationale: nextRationale,
      key_signals: input.key_signals !== undefined ? input.key_signals : session.key_signals,
      assumptions: input.assumptions !== undefined ? input.assumptions : session.assumptions,
      uncertainty_notes:
        input.uncertainty_notes !== undefined
          ? input.uncertainty_notes
          : session.uncertainty_notes,
      requested_sources:
        input.requested_sources !== undefined
          ? input.requested_sources
          : session.requested_sources,
    },
    "draft_saved",
    `probability=${nextForecast.probability ?? "null"}; confidence=${nextForecast.confidence ?? "null"}`,
  );

  await saveReplaySession(updated);
  return updated;
}

export async function lockReplaySession(sessionId: string): Promise<ReplaySession> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  if (session.status !== "draft") {
    throw new ReplaySessionValidationError(`Cannot lock session with status ${session.status}`);
  }

  const probability = validateProbability(session.user_forecast.probability, true);
  const lockedAt = new Date().toISOString();

  const updated = appendAudit(
    {
      ...session,
      status: "locked",
      locked_at: lockedAt,
      user_forecast: {
        ...session.user_forecast,
        probability,
      },
    },
    "forecast_locked",
    `probability=${probability}; confidence=${session.user_forecast.confidence ?? "null"}`,
  );

  await saveReplaySession(updated);
  return updated;
}
