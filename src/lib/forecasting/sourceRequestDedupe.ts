import type {
  CreateSourceRequestInput,
  ForecastSourceRequest,
  ForecastSourceRequestType,
} from "@/types/forecasting";

export type AgentSourceRequestMatchCriteria = {
  session_id: string;
  agent_id: string;
  requested_source_id: string;
  request_type: ForecastSourceRequestType;
  cutoff_year: number;
};

export function matchesAgentSourceRequest(
  request: ForecastSourceRequest,
  criteria: AgentSourceRequestMatchCriteria,
): boolean {
  return (
    request.session_id === criteria.session_id &&
    request.agent_id === criteria.agent_id &&
    request.requested_source_id === criteria.requested_source_id &&
    request.request_type === criteria.request_type &&
    request.cutoff_year === criteria.cutoff_year
  );
}

export function findReusableAgentSourceRequest(
  existing: ForecastSourceRequest[],
  criteria: AgentSourceRequestMatchCriteria,
): ForecastSourceRequest | null {
  return (
    existing.find(
      (request) =>
        matchesAgentSourceRequest(request, criteria) &&
        (request.status === "open" || request.status === "fulfilled"),
    ) ?? null
  );
}

export function buildAgentSourceRequestCriteria(
  sessionId: string,
  agentId: string,
  input: CreateSourceRequestInput,
  cutoffYear: number,
): AgentSourceRequestMatchCriteria {
  return {
    session_id: sessionId,
    agent_id: agentId,
    requested_source_id: input.requested_source_id,
    request_type: input.request_type,
    cutoff_year: cutoffYear,
  };
}
