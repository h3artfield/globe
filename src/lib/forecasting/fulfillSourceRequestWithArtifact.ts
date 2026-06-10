import type {
  ForecastSourceRequest,
  FulfillSourceRequestBody,
  ReplaySession,
  SourceFulfillmentArtifact,
  SourceFulfillmentType,
} from "@/types/forecasting";
import { findSourceFulfillmentAdapter } from "@/lib/forecasting/sourceFulfillment/registry";
import type { SourceFulfillmentInput } from "@/lib/forecasting/sourceFulfillment/types";
import {
  loadSourceRequest,
  saveSourceRequest,
} from "@/lib/forecasting/sourceRequestStore";
import { saveSourceFulfillment } from "@/lib/forecasting/sourceFulfillmentStore";
import { filterFulfillmentRecordsForSession } from "@/lib/forecasting/sourceFulfillment/filterFulfillmentRecords";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";

function normalizeInput(body: FulfillSourceRequestBody): SourceFulfillmentInput {
  const localPaths = [
    ...(body.local_paths ?? []),
    ...(body.local_path ? [body.local_path] : []),
  ].filter(Boolean);
  return {
    local_paths: localPaths,
    note_text: body.note_text,
    safe_for_evidence_snapshot: body.safe_for_evidence_snapshot,
    summary: body.summary ?? body.fulfillment_notes,
    limitations: body.limitations,
    confidence: body.confidence,
    fulfilled_by: body.fulfilled_by,
  };
}

function inferFulfillmentType(
  body: FulfillSourceRequestBody,
  adapterId: string | null,
): SourceFulfillmentType {
  if (body.fulfillment_type) {
    return body.fulfillment_type;
  }
  if (adapterId && adapterId !== "manual_file") {
    return "local_adapter";
  }
  const input = normalizeInput(body);
  if (input.local_paths?.length) {
    return "human_file";
  }
  if (input.note_text?.trim()) {
    return "note_only";
  }
  return "note_only";
}

export type FulfillSourceRequestResult = {
  request: ForecastSourceRequest;
  artifact: SourceFulfillmentArtifact;
};

export async function fulfillSourceRequestWithArtifact(
  sourceRequestId: string,
  body: FulfillSourceRequestBody,
): Promise<FulfillSourceRequestResult> {
  const request = await loadSourceRequest(sourceRequestId);
  if (!request) {
    throw new Error(`Source request not found: ${sourceRequestId}`);
  }
  if (request.status !== "open") {
    throw new Error(`Source request is not open (status=${request.status})`);
  }

  const input = normalizeInput(body);
  const adapter = findSourceFulfillmentAdapter(request, input, body.adapter_id);
  if (!adapter) {
    throw new Error(
      "No fulfillment adapter matches this request. Provide local_paths, note_text, or adapter_id.",
    );
  }

  const fulfillmentType = inferFulfillmentType(body, adapter.adapter_id);
  let result = await adapter.fulfill(request, input);
  result = adapter.validateCutoff(request, result);

  const session = await loadReplaySession(request.session_id);
  if (session) {
    const filtered = filterFulfillmentRecordsForSession(result.records_usable, request, session);
    const irrelevant = filtered.rejected_irrelevant_count;
    result = {
      ...result,
      records_usable: filtered.usable,
      records_rejected: result.records_rejected + irrelevant,
      rejected_future_records_count:
        result.rejected_future_records_count + filtered.rejected_future_count,
      summary:
        irrelevant > 0
          ? `${result.summary} Filtered ${irrelevant} irrelevant record(s) (source/target/template/cutoff).`
          : result.summary,
    };
  }

  if (body.summary?.trim()) {
    result = { ...result, summary: body.summary.trim() };
  }
  if (body.limitations?.trim()) {
    result = { ...result, limitations: body.limitations.trim() };
  }
  if (typeof body.safe_for_evidence_snapshot === "boolean") {
    result = { ...result, safe_for_evidence_snapshot: body.safe_for_evidence_snapshot };
  }

  const artifact = adapter.writeFulfillmentArtifact(request, result, {
    fulfilled_by: body.fulfilled_by?.trim() || "local_operator",
    fulfillment_type: fulfillmentType,
  });

  await saveSourceFulfillment(artifact);

  const usableForOriginal = !request.too_late_for_forecast;
  const updatedRequest: ForecastSourceRequest = {
    ...request,
    status: "fulfilled",
    fulfilled_at: artifact.created_at,
    fulfilled_by: artifact.fulfilled_by,
    fulfillment_notes: body.fulfillment_notes?.trim() || artifact.summary,
    suggested_local_path: artifact.local_paths[0] ?? request.suggested_local_path,
    fulfillment_id: artifact.fulfillment_id,
    usable_for_original_forecast: usableForOriginal,
  };
  await saveSourceRequest(updatedRequest);

  return { request: updatedRequest, artifact };
}

export async function loadUsableFulfillmentEvidenceForSession(
  session: ReplaySession,
): Promise<{
  included_records: SourceFulfillmentArtifact["records_usable"];
  excluded_future_records_count: number;
  excluded_irrelevant_count: number;
  source_paths: string[];
  fulfillment_summaries: string[];
}> {
  const { loadSourceFulfillmentsForSession } = await import(
    "@/lib/forecasting/sourceFulfillmentStore"
  );
  const { loadSourceRequest } = await import("@/lib/forecasting/sourceRequestStore");
  const artifacts = await loadSourceFulfillmentsForSession(session.session_id);
  const included: SourceFulfillmentArtifact["records_usable"] = [];
  const sourcePaths = new Set<string>();
  const fulfillmentSummaries: string[] = [];
  let excludedFuture = 0;
  let excludedIrrelevant = 0;

  for (const artifact of artifacts) {
    if (!artifact.safe_for_evidence_snapshot) {
      continue;
    }
    if (!artifact.usable_for_original_forecast) {
      continue;
    }
    const request = await loadSourceRequest(artifact.source_request_id);
    if (!request) {
      continue;
    }
    for (const path of artifact.local_paths) {
      sourcePaths.add(path);
    }
    const filtered = filterFulfillmentRecordsForSession(
      artifact.records_usable,
      request,
      session,
    );
    excludedFuture += filtered.rejected_future_count;
    excludedIrrelevant += filtered.rejected_irrelevant_count;
    if (filtered.usable.length > 0) {
      fulfillmentSummaries.push(
        `${filtered.usable.length} from ${artifact.source_id} (${artifact.fulfillment_id})`,
      );
    }
    included.push(...filtered.usable);
  }

  return {
    included_records: included,
    excluded_future_records_count: excludedFuture,
    excluded_irrelevant_count: excludedIrrelevant,
    source_paths: [...sourcePaths],
    fulfillment_summaries: fulfillmentSummaries,
  };
}
