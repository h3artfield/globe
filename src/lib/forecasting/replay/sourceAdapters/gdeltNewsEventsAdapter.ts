import type { ReplaySession } from "@/types/forecasting";
import { GDELT_NEWS_SOURCE_ID } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import { findNewsEvidenceForSession } from "@/lib/forecasting/gdelt/findNewsEvidenceForSession";
import { newsRecordToIncludedRecord } from "@/lib/forecasting/gdelt/normalizeGdeltNewsEvent";
import type { ReplaySourceAdapter } from "@/lib/forecasting/replay/sourceAdapters/types";

const SOURCE_ID = "gdelt_news_events";

export const gdeltNewsEventsAdapter: ReplaySourceAdapter = {
  source_id: SOURCE_ID,

  canBuildEvidenceSnapshot(session: ReplaySession): boolean {
    return session.allowed_source_ids.includes(GDELT_NEWS_SOURCE_ID);
  },

  canResolve(): boolean {
    return false;
  },

  async buildEvidenceSnapshot(session) {
    const records = await findNewsEvidenceForSession(session);
    if (records.length === 0) {
      return {
        included_records: [],
        missing_reason: SOURCE_ID,
        excluded_future_records_count: 0,
        source_paths: ["data/forecasting/evidence_sources/gdelt/news_events.v1.jsonl"],
        confidence: "low",
        limitations: ["No GDELT news records found in local cache for this session context."],
      };
    }

    return {
      included_records: records.map(newsRecordToIncludedRecord),
      missing_reason: null,
      excluded_future_records_count: 0,
      source_paths: ["data/forecasting/evidence_sources/gdelt/news_events.v1.jsonl"],
      confidence: records.length >= 3 ? "medium" : "low",
      limitations: ["GDELT news evidence is local/mock intake; not full RAG answer generation."],
    };
  },

  async resolve() {
    return {
      outcome: "missing_evidence" as const,
      resolved_value: null,
      prior_value: null,
      comparison_value: null,
      source_records: [],
      source_paths: [],
      confidence: "low" as const,
      limitations: ["GDELT news adapter does not resolve forecast outcomes."],
    };
  },
};
