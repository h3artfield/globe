import type {
  PlanSourceRequestsResult,
  ReplaySession,
  SessionEvidenceAssessment,
} from "@/types/forecasting";
import { assessSessionEvidenceFromInputs } from "@/lib/forecasting/evidence/assessSessionEvidence";
import { loadSessionEvidenceAssessment } from "@/lib/forecasting/evidence/evidenceAssessmentStore";
import { createSessionSourceRequest } from "@/lib/forecasting/sessionSourceRequests";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";
import { findReusableSessionSourceRequest } from "@/lib/forecasting/sourceRequestDedupe";
import { getReplayEvidenceSnapshot } from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function requestTypeForSource(sourceId: string): "dataset_refresh" | "api_fetch" {
  if (sourceId === "gdelt_news_events") {
    return "api_fetch";
  }
  return "dataset_refresh";
}

export async function planSourceRequestsFromAssessment(
  sessionId: string,
  assessmentInput?: SessionEvidenceAssessment | null,
): Promise<PlanSourceRequestsResult> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }
  if (session.status !== "draft") {
    throw new ReplaySessionValidationError(
      `Source planning is only allowed on draft sessions (status=${session.status})`,
    );
  }

  let assessment = assessmentInput ?? (await loadSessionEvidenceAssessment(sessionId));
  if (!assessment) {
    const snapshot = await getReplayEvidenceSnapshot(sessionId);
    assessment = assessSessionEvidenceFromInputs(session, snapshot);
  }

  const existingRequests = await listSourceRequestsForSession(sessionId);
  const created = [];
  const reused = [];
  const skipped = [];

  for (const gap of assessment.source_gaps) {
    if (!session.allowed_source_ids.includes(gap.missing_source_id)) {
      skipped.push(gap);
      continue;
    }

    const input = {
      request_type: requestTypeForSource(gap.missing_source_id),
      requested_source_id: gap.missing_source_id,
      reason: gap.reason,
      priority: gap.priority,
      human_instructions: `Planned from evidence assessment ${assessment.assessment_id} (${gap.gap_id}).`,
    };

    const reusable = findReusableSessionSourceRequest(existingRequests, {
      session_id: sessionId,
      requested_source_id: gap.missing_source_id,
      request_type: input.request_type,
      cutoff_year: session.forecast_year,
    });

    if (reusable) {
      reused.push(reusable);
      continue;
    }

    const request = await createSessionSourceRequest(sessionId, input);
    created.push(request);
    existingRequests.push(request);
  }

  return { created, reused, skipped };
}
