import type {
  ForecastSourceRequest,
  FulfillSourceRequestBody,
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
  sessionId: string,
  cutoffYear: number,
): Promise<{
  included_records: SourceFulfillmentArtifact["records_usable"];
  excluded_future_records_count: number;
  source_paths: string[];
}> {
  const { loadSourceFulfillmentsForSession } = await import(
    "@/lib/forecasting/sourceFulfillmentStore"
  );
  const artifacts = await loadSourceFulfillmentsForSession(sessionId);
  const included: SourceFulfillmentArtifact["records_usable"] = [];
  const sourcePaths = new Set<string>();
  let excludedFuture = 0;

  for (const artifact of artifacts) {
    if (!artifact.safe_for_evidence_snapshot) {
      continue;
    }
    if (!artifact.usable_for_original_forecast) {
      continue;
    }
    for (const path of artifact.local_paths) {
      sourcePaths.add(path);
    }
    for (const record of artifact.records_usable) {
      const year = record.year;
      if (year !== null && year > cutoffYear) {
        excludedFuture += 1;
        continue;
      }
      included.push(record);
    }
    excludedFuture += artifact.rejected_future_records_count;
  }

  return {
    included_records: included,
    excluded_future_records_count: excludedFuture,
    source_paths: [...sourcePaths],
  };
}
