import type { ReplayResolution, ReplaySession } from "@/types/forecasting";
import {
  createResolutionId,
  saveReplayResolution,
} from "@/lib/forecasting/replayResolutionStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import { getPrimaryResolutionAdapter } from "@/lib/forecasting/replay/sourceAdapters/registry";

function assertResolutionAllowed(session: ReplaySession): void {
  if (session.status === "draft") {
    throw new ReplaySessionValidationError(
      "Resolution requires a locked forecast; session is still draft",
    );
  }
  if (session.status === "resolved") {
    throw new ReplaySessionValidationError("Session is already resolved");
  }
  if (session.status !== "locked") {
    throw new ReplaySessionValidationError(
      `Resolution requires locked status (current=${session.status})`,
    );
  }
}

function appendAudit(session: ReplaySession, action: string, details?: string): ReplaySession {
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

export async function resolveReplaySession(sessionId: string): Promise<ReplayResolution> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  assertResolutionAllowed(session);

  const adapter = getPrimaryResolutionAdapter(session);
  if (!adapter || !adapter.canResolve(session)) {
    throw new ReplaySessionValidationError("No resolution adapter available for this session");
  }

  const result = await adapter.resolve(session);

  const resolution: ReplayResolution = {
    resolution_id: createResolutionId(),
    session_id: session.session_id,
    template_id: session.template_id,
    created_at: new Date().toISOString(),
    resolution_year: session.resolution_year,
    outcome: result.outcome,
    resolved_value: result.resolved_value,
    prior_value: result.prior_value,
    comparison_value: result.comparison_value,
    source_records: result.source_records,
    source_paths: result.source_paths,
    confidence: result.confidence,
    limitations: result.limitations.join(" ").trim(),
  };

  await saveReplayResolution(resolution);

  const updatedSession = appendAudit(
    {
      ...session,
      status: "resolved",
      resolution_id: resolution.resolution_id,
    },
    "session_resolved",
    `outcome=${resolution.outcome}; confidence=${resolution.confidence}`,
  );
  await saveReplaySession(updatedSession);

  return resolution;
}

export async function getReplayResolution(sessionId: string): Promise<ReplayResolution | null> {
  const { loadReplayResolution } = await import("@/lib/forecasting/replayResolutionStore");
  return loadReplayResolution(sessionId);
}
