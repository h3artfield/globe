import type {
  ReplayEvidenceIncludedRecord,
  ReplayForecastConfidence,
  ReplayResolutionOutcome,
  ReplayResolutionSourceRecord,
  ReplaySession,
} from "@/types/forecasting";

export type ReplaySourceAdapterBuildResult = {
  included_records: ReplayEvidenceIncludedRecord[];
  missing_reason: string | null;
  excluded_future_records_count: number;
  source_paths: string[];
  confidence: ReplayForecastConfidence;
  limitations: string[];
};

export type ReplaySourceAdapterResolveResult = {
  outcome: ReplayResolutionOutcome;
  resolved_value: number | boolean | null;
  prior_value: number | boolean | null;
  comparison_value: number | boolean | null;
  source_records: ReplayResolutionSourceRecord[];
  source_paths: string[];
  confidence: ReplayForecastConfidence;
  limitations: string[];
};

export type ReplaySourceAdapter = {
  source_id: string;
  canBuildEvidenceSnapshot(session: ReplaySession): boolean;
  canResolve(session: ReplaySession): boolean;
  buildEvidenceSnapshot(session: ReplaySession): Promise<ReplaySourceAdapterBuildResult>;
  resolve(session: ReplaySession): Promise<ReplaySourceAdapterResolveResult>;
};

export function mergeConfidence(
  values: ReplayForecastConfidence[],
): ReplayForecastConfidence {
  if (values.includes("low")) {
    return "low";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "high";
}

export function metricRecordToEvidence(
  row: {
    raw_record_id: string;
    source_id: string;
    metric_id: string;
    year: number;
    value: number;
    unit: string;
    country_code: string;
  },
): ReplayEvidenceIncludedRecord {
  return {
    record_id: row.raw_record_id,
    source_id: row.source_id,
    label: `${row.metric_id} (${row.country_code}, ${row.year})`,
    year: row.year,
    date: null,
    value_summary: `${row.value} ${row.unit}`,
  };
}

export function metricRecordToResolutionSource(
  row: {
    raw_record_id: string;
    source_id: string;
    metric_id: string;
    year: number;
    value: number;
    unit: string;
    country_code: string;
  },
): ReplayResolutionSourceRecord {
  return {
    record_id: row.raw_record_id,
    source_id: row.source_id,
    label: `${row.metric_id} (${row.country_code}, ${row.year})`,
    year: row.year,
    date: null,
    value_summary: `${row.value} ${row.unit}`,
  };
}
