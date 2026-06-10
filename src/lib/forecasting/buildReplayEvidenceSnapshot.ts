import type { ReplayEvidenceSnapshot, ReplayForecastConfidence, ReplaySession } from "@/types/forecasting";
import {
  createEvidenceSnapshotId,
  saveReplayEvidenceSnapshot,
} from "@/lib/forecasting/replayEvidenceSnapshotStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import {
  getReplaySourceAdaptersForSession,
  resolveAdapterSourceId,
} from "@/lib/forecasting/replay/sourceAdapters/registry";
import { mergeConfidence } from "@/lib/forecasting/replay/sourceAdapters/types";
import { loadUsableFulfillmentEvidenceForSession } from "@/lib/forecasting/fulfillSourceRequestWithArtifact";
import { dedupeEvidenceRecords } from "@/lib/forecasting/sourceFulfillment/filterFulfillmentRecords";

function assertSnapshotAllowed(status: ReplaySession["status"]): void {
  if (status !== "draft" && status !== "locked") {
    throw new ReplaySessionValidationError(
      `Evidence snapshot can only be created for draft or locked sessions (status=${status})`,
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

export async function buildReplayEvidenceSnapshot(
  sessionId: string,
): Promise<ReplayEvidenceSnapshot> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  assertSnapshotAllowed(session.status);
  const postLockRegeneration = session.status === "locked";

  const adapters = getReplaySourceAdaptersForSession(session);
  const adapterRecords = [];
  const missingSources: string[] = [];
  const sourcePaths = new Set<string>();
  const limitations: string[] = [];
  let excludedFutureCount = 0;
  const confidences: ReplayForecastConfidence[] = [];

  for (const sourceId of session.allowed_source_ids) {
    const adapterKey = resolveAdapterSourceId(sourceId);
    const adapter = adapters.find((item) => item.source_id === adapterKey);
    if (!adapter || !adapter.canBuildEvidenceSnapshot(session)) {
      missingSources.push(sourceId);
      limitations.push(`No adapter available for source ${sourceId}.`);
      confidences.push("low" as const);
      continue;
    }

    const result = await adapter.buildEvidenceSnapshot(session);
    adapterRecords.push(...result.included_records);
    excludedFutureCount += result.excluded_future_records_count;
    for (const path of result.source_paths) {
      sourcePaths.add(path);
    }
    limitations.push(...result.limitations);
    confidences.push(result.confidence);
    if (result.missing_reason) {
      missingSources.push(sourceId);
    }
  }

  const fulfillmentEvidence = await loadUsableFulfillmentEvidenceForSession(session);
  const fulfillmentRecords = fulfillmentEvidence.included_records;
  excludedFutureCount += fulfillmentEvidence.excluded_future_records_count;

  for (const fulfillmentPath of fulfillmentEvidence.source_paths) {
    sourcePaths.add(fulfillmentPath);
  }

  const mergedRecords = dedupeEvidenceRecords([...adapterRecords, ...fulfillmentRecords]);
  const adapterRecordIds = new Set(adapterRecords.map((record) => record.record_id));
  const fulfillmentRecordsIncluded = mergedRecords.filter(
    (record) => !adapterRecordIds.has(record.record_id),
  ).length;
  const fulfillmentExcludedIrrelevant = fulfillmentEvidence.excluded_irrelevant_count;

  if (fulfillmentRecordsIncluded > 0) {
    limitations.push(
      `Fulfillment added ${fulfillmentRecordsIncluded} record(s): ${fulfillmentEvidence.fulfillment_summaries.join("; ")}.`,
    );
  }
  if (fulfillmentExcludedIrrelevant > 0) {
    limitations.push(
      `Excluded ${fulfillmentExcludedIrrelevant} fulfilled record(s) as irrelevant (wrong source, target, template metric, or cutoff).`,
    );
  }
  if (postLockRegeneration) {
    limitations.push(
      "Snapshot regenerated after lock; this view is for review only and does not replace the forecast evidence snapshot used at lock.",
    );
  }

  const confidence = mergeConfidence(confidences.length > 0 ? confidences : ["low"]);
  const adapterOnlyCount = mergedRecords.length - fulfillmentRecordsIncluded;
  const summary =
    mergedRecords.length === 0
      ? `No evidence records available at or before as_of year ${session.forecast_year}.`
      : `${mergedRecords.length} record(s) at or before as_of year ${session.forecast_year} (${adapterOnlyCount} adapter + ${fulfillmentRecordsIncluded} fulfillment); ${excludedFutureCount} future excluded; ${fulfillmentExcludedIrrelevant} irrelevant fulfillment excluded.`;

  const snapshot: ReplayEvidenceSnapshot = {
    evidence_snapshot_id: createEvidenceSnapshotId(),
    session_id: session.session_id,
    template_id: session.template_id,
    created_at: new Date().toISOString(),
    as_of_year: session.forecast_year,
    allowed_source_ids: session.allowed_source_ids,
    included_records: mergedRecords,
    missing_sources: missingSources,
    excluded_future_records_count: excludedFutureCount,
    fulfillment_records_included: fulfillmentRecordsIncluded,
    fulfillment_records_excluded_irrelevant: fulfillmentExcludedIrrelevant,
    post_lock_regeneration: postLockRegeneration,
    summary,
    limitations: limitations.join(" ").trim(),
    source_paths: [...sourcePaths],
    confidence,
  };

  await saveReplayEvidenceSnapshot(snapshot);

  const sessionUpdate: ReplaySession = postLockRegeneration
    ? appendAudit(
        session,
        "evidence_snapshot_regenerated_after_lock",
        `records=${mergedRecords.length}; forecast_snapshot=${session.evidence_snapshot_id ?? "none"}`,
      )
    : appendAudit(
        {
          ...session,
          evidence_snapshot_id: snapshot.evidence_snapshot_id,
        },
        "evidence_snapshot_created",
        `records=${mergedRecords.length}; excluded_future=${excludedFutureCount}`,
      );
  await saveReplaySession(sessionUpdate);

  return snapshot;
}

export async function getReplayEvidenceSnapshot(
  sessionId: string,
): Promise<ReplayEvidenceSnapshot | null> {
  const { loadReplayEvidenceSnapshot } = await import(
    "@/lib/forecasting/replayEvidenceSnapshotStore"
  );
  return loadReplayEvidenceSnapshot(sessionId);
}
