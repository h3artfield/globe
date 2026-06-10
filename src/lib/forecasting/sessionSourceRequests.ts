import type { CreateSourceRequestInput, ForecastSourceRequest } from "@/types/forecasting";
import { createSourceRequest } from "@/lib/forecasting/sourceRequestStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export async function createSessionSourceRequest(
  sessionId: string,
  input: CreateSourceRequestInput,
): Promise<ForecastSourceRequest> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  const request = await createSourceRequest(session, input);

  const requestedSources = [...new Set([...session.requested_sources, request.requested_source_id])];
  const sourceRequestIds = session.source_request_ids.includes(request.source_request_id)
    ? session.source_request_ids
    : [...session.source_request_ids, request.source_request_id];
  const updated = {
    ...session,
    requested_sources: requestedSources,
    source_request_ids: sourceRequestIds,
    audit_trail: [
      ...session.audit_trail,
      {
        at: new Date().toISOString(),
        action: "source_request_created",
        details: `${request.request_type}:${request.requested_source_id}`,
      },
    ],
  };
  await saveReplaySession(updated);

  return request;
}

export async function listSessionSourceRequests(
  sessionId: string,
): Promise<ForecastSourceRequest[]> {
  const { listSourceRequestsForSession } = await import("@/lib/forecasting/sourceRequestStore");
  return listSourceRequestsForSession(sessionId);
}
