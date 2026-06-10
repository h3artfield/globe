import { findNewsEvidenceForSession } from "@/lib/forecasting/gdelt/findNewsEvidenceForSession";
import { newsRecordToIncludedRecord } from "@/lib/forecasting/gdelt/normalizeGdeltNewsEvent";
import {
  buildReplayEvidenceSnapshot,
  getReplayEvidenceSnapshot,
} from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { GDELT_NEWS_SOURCE_ID } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import { saveReplayEvidenceSnapshot } from "@/lib/forecasting/replayEvidenceSnapshotStore";
import { loadReplaySession, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";
import { dedupeEvidenceRecords } from "@/lib/forecasting/sourceFulfillment/filterFulfillmentRecords";

export async function attachNewsEvidenceToSession(sessionId: string) {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }
  if (session.status !== "draft" && session.status !== "locked") {
    throw new ReplaySessionValidationError(
      `News evidence can only be attached to draft or locked sessions (status=${session.status})`,
    );
  }
  if (!session.allowed_source_ids.includes(GDELT_NEWS_SOURCE_ID)) {
    throw new ReplaySessionValidationError(
      `Session does not allow ${GDELT_NEWS_SOURCE_ID} in allowed_source_ids`,
    );
  }

  const newsRecords = await findNewsEvidenceForSession(session);
  const includedFromNews = newsRecords.map(newsRecordToIncludedRecord);

  let snapshot = await getReplayEvidenceSnapshot(sessionId);
  if (!snapshot) {
    snapshot = await buildReplayEvidenceSnapshot(sessionId);
  }

  const existingNewsIds = new Set(
    (snapshot.news_evidence_records ?? []).map((record) => record.evidence_record_id),
  );
  const mergedNews = [
    ...(snapshot.news_evidence_records ?? []),
    ...newsRecords.filter((record) => !existingNewsIds.has(record.evidence_record_id)),
  ];

  const mergedIncluded = dedupeEvidenceRecords([
    ...snapshot.included_records,
    ...includedFromNews,
  ]);

  const updatedSnapshot = {
    ...snapshot,
    included_records: mergedIncluded,
    news_evidence_records: mergedNews,
    missing_sources: snapshot.missing_sources.filter((sourceId) => sourceId !== GDELT_NEWS_SOURCE_ID),
    summary: `${mergedIncluded.length} record(s) including ${mergedNews.length} GDELT news article(s) for session ${sessionId}.`,
    limitations: `${snapshot.limitations} GDELT news evidence attached (${newsRecords.length} new).`.trim(),
    source_paths: [
      ...snapshot.source_paths,
      "data/forecasting/evidence_sources/gdelt/news_events.v1.jsonl",
    ],
  };

  await saveReplayEvidenceSnapshot(updatedSnapshot);

  const updatedSession = {
    ...session,
    evidence_snapshot_id: session.evidence_snapshot_id ?? updatedSnapshot.evidence_snapshot_id,
    audit_trail: [
      ...session.audit_trail,
      {
        at: new Date().toISOString(),
        action: "gdelt_news_evidence_attached",
        details: `records=${newsRecords.length}; total_news=${mergedNews.length}`,
      },
    ],
  };
  await saveReplaySession(updatedSession);

  return {
    session_id: sessionId,
    attached_count: newsRecords.length,
    total_news_records: mergedNews.length,
    snapshot: updatedSnapshot,
    news_records: newsRecords,
  };
}
