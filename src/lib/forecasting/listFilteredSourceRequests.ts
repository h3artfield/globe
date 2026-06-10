import type {
  ForecastSourceRequest,
  ForecastSourceRequestPriority,
  ForecastSourceRequestStatus,
  ForecastSourceRequestType,
} from "@/types/forecasting";
import { listAllSourceRequests } from "@/lib/forecasting/sourceRequestStore";

export type SourceRequestFilters = {
  status?: ForecastSourceRequestStatus;
  request_type?: ForecastSourceRequestType;
  priority?: ForecastSourceRequestPriority;
  source_id?: string;
  agent_id?: string;
  template_id?: string;
  country_iso3?: string;
  relationship_pair?: string;
  cutoff_year?: number;
};

export async function listFilteredSourceRequests(
  filters: SourceRequestFilters = {},
): Promise<ForecastSourceRequest[]> {
  let requests = await listAllSourceRequests();

  if (filters.status) {
    requests = requests.filter((request) => request.status === filters.status);
  }
  if (filters.request_type) {
    requests = requests.filter((request) => request.request_type === filters.request_type);
  }
  if (filters.priority) {
    requests = requests.filter((request) => request.priority === filters.priority);
  }
  if (filters.source_id) {
    requests = requests.filter((request) => request.requested_source_id === filters.source_id);
  }
  if (filters.agent_id) {
    requests = requests.filter((request) => request.agent_id === filters.agent_id);
  }
  if (filters.template_id) {
    requests = requests.filter((request) => request.template_id === filters.template_id);
  }
  if (filters.country_iso3) {
    requests = requests.filter(
      (request) => request.target_country_iso3 === filters.country_iso3,
    );
  }
  if (filters.relationship_pair) {
    requests = requests.filter(
      (request) => request.relationship_pair === filters.relationship_pair,
    );
  }
  if (filters.cutoff_year != null) {
    requests = requests.filter((request) => request.cutoff_year === filters.cutoff_year);
  }

  return requests;
}
