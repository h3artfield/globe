import { appendFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type {
  CreateSourceRequestInput,
  ForecastSourceRequest,
  ForecastSourceRequestStatus,
  ReplaySession,
} from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const REQUESTS_DIR = repoPath("data", "forecasting", "source_requests");

function requestFilePath(sourceRequestId: string): string {
  return path.join(REQUESTS_DIR, sourceRequestId, "request.v1.json");
}

export function createSourceRequestId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `source_req_${stamp}_${suffix}`;
}

const SOURCE_ADAPTER_HINTS: Record<string, string> = {
  un_comtrade: "un_comtrade_bilateral",
  vdem: "vdem",
  ucdp: "ucdp",
  unodc: "unodc",
  world_values_survey: "wvs",
};

export function suggestedAdapterForSource(sourceId: string): string | null {
  return SOURCE_ADAPTER_HINTS[sourceId] ?? null;
}

export async function saveSourceRequest(request: ForecastSourceRequest): Promise<void> {
  await writeJsonFile(requestFilePath(request.source_request_id), request);
}

export async function loadSourceRequest(
  sourceRequestId: string,
): Promise<ForecastSourceRequest | null> {
  const filePath = requestFilePath(sourceRequestId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastSourceRequest>(filePath);
}

export async function listAllSourceRequests(): Promise<ForecastSourceRequest[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(REQUESTS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const requests: ForecastSourceRequest[] = [];
  for (const id of entries) {
    const request = await loadSourceRequest(id);
    if (request) {
      requests.push(request);
    }
  }
  return requests.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listSourceRequestsForSession(
  sessionId: string,
): Promise<ForecastSourceRequest[]> {
  const all = await listAllSourceRequests();
  return all.filter((request) => request.session_id === sessionId);
}

function targetCountryIso3(session: ReplaySession): string | null {
  if (session.target.target_type === "country") {
    return session.target.target_id;
  }
  return session.target.target_id.split("_")[0] ?? null;
}

function relationshipPair(session: ReplaySession): string | null {
  if (session.target.target_type === "relationship") {
    return session.target.target_id;
  }
  return null;
}

export async function createSourceRequest(
  session: ReplaySession,
  input: CreateSourceRequestInput,
): Promise<ForecastSourceRequest> {
  const sourceId = input.requested_source_id.trim();
  const request: ForecastSourceRequest = {
    source_request_id: createSourceRequestId(),
    session_id: session.session_id,
    agent_id: session.agent_id,
    template_id: session.template_id,
    created_at: new Date().toISOString(),
    request_type: input.request_type,
    status: "open",
    priority: input.priority ?? "medium",
    requested_source_id: sourceId,
    requested_source_name: input.requested_source_name?.trim() || sourceId,
    reason: input.reason.trim(),
    expected_value: input.expected_value?.trim() ?? "",
    target_country_iso3: targetCountryIso3(session),
    relationship_pair: relationshipPair(session),
    forecast_year: session.forecast_year,
    cutoff_year: session.forecast_year,
    no_future_leakage_required: true,
    suggested_api_adapter: suggestedAdapterForSource(sourceId),
    suggested_local_path: input.suggested_local_path?.trim() ?? null,
    human_instructions: input.human_instructions?.trim() ?? "",
    fulfilled_at: null,
    fulfilled_by: null,
    fulfillment_notes: "",
    linked_evidence_snapshot_id: null,
    too_late_for_forecast: session.status !== "draft",
    fulfillment_id: null,
    usable_for_original_forecast: null,
  };

  await saveSourceRequest(request);
  return request;
}

export async function updateSourceRequestStatus(
  sourceRequestId: string,
  status: ForecastSourceRequestStatus,
  notes?: string,
): Promise<ForecastSourceRequest> {
  const request = await loadSourceRequest(sourceRequestId);
  if (!request) {
    throw new Error(`Source request not found: ${sourceRequestId}`);
  }
  if (request.status !== "open" && status !== request.status) {
    throw new Error(`Cannot change status from ${request.status} to ${status}`);
  }

  const updated: ForecastSourceRequest = {
    ...request,
    status,
    fulfillment_notes: notes?.trim() ?? request.fulfillment_notes,
    fulfilled_at: status === "fulfilled" ? new Date().toISOString() : request.fulfilled_at,
  };
  await saveSourceRequest(updated);
  return updated;
}

export async function fulfillSourceRequest(
  sourceRequestId: string,
  input: {
    fulfilled_by?: string;
    fulfillment_notes?: string;
    suggested_local_path?: string;
    linked_evidence_snapshot_id?: string;
  },
): Promise<ForecastSourceRequest> {
  const request = await loadSourceRequest(sourceRequestId);
  if (!request) {
    throw new Error(`Source request not found: ${sourceRequestId}`);
  }

  const updated: ForecastSourceRequest = {
    ...request,
    status: "fulfilled",
    fulfilled_at: new Date().toISOString(),
    fulfilled_by: input.fulfilled_by?.trim() ?? "local_operator",
    fulfillment_notes: input.fulfillment_notes?.trim() ?? "",
    suggested_local_path: input.suggested_local_path?.trim() ?? request.suggested_local_path,
    linked_evidence_snapshot_id:
      input.linked_evidence_snapshot_id ?? request.linked_evidence_snapshot_id,
  };
  await saveSourceRequest(updated);
  return updated;
}
