import type { CreateReplaySessionRequest, ReplaySession } from "@/types/forecasting";
import { formatReplayQuestion } from "@/lib/forecasting/formatReplayQuestion";
import { loadReplayTemplate } from "@/lib/forecasting/loadReplayTemplates";
import { materializeResolutionSpec } from "@/lib/forecasting/materializeResolutionSpec";
import { createSessionId } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export { ReplaySessionValidationError };

export async function createReplaySessionFromTemplate(
  input: CreateReplaySessionRequest,
): Promise<ReplaySession> {
  const template = await loadReplayTemplate(input.template_id);
  if (!template) {
    throw new ReplaySessionValidationError(`Unknown template_id: ${input.template_id}`);
  }

  const targetId = input.target.trim().toUpperCase();
  if (!template.allowed_targets.includes(targetId)) {
    throw new ReplaySessionValidationError(
      `Target ${targetId} is not allowed for template ${template.template_id}`,
    );
  }

  const forecastYear = input.year;
  if (!Number.isInteger(forecastYear) || forecastYear < 1900 || forecastYear > 2100) {
    throw new ReplaySessionValidationError("year must be an integer between 1900 and 2100");
  }
  if (forecastYear >= template.resolution_year) {
    throw new ReplaySessionValidationError(
      `forecast year must be before resolution year ${template.resolution_year}`,
    );
  }

  const createdAt = new Date().toISOString();
  const sessionId = createSessionId();

  return {
    session_id: sessionId,
    template_id: template.template_id,
    created_at: createdAt,
    locked_at: null,
    target: {
      target_type: template.target_type,
      target_id: targetId,
    },
    forecast_year: forecastYear,
    resolution_year: template.resolution_year,
    question_text: formatReplayQuestion(template, targetId, forecastYear),
    resolution_spec: materializeResolutionSpec(
      template.resolution_spec,
      forecastYear,
      template.resolution_year,
    ),
    allowed_source_ids: [...template.allowed_source_ids],
    status: "draft",
    user_forecast: {
      probability: null,
      confidence: null,
      rationale: "",
    },
    evidence_snapshot_id: null,
    resolution_id: null,
    audit_trail: [
      {
        at: createdAt,
        action: "session_created",
        details: `template=${template.template_id}; target=${targetId}; forecast_year=${forecastYear}`,
      },
    ],
  };
}
