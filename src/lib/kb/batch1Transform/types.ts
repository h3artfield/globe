export type TransformSkipReason =
  | "non_mvp_country"
  | "missing_country"
  | "missing_date"
  | "missing_required_field"
  | "unmapped_metric_column"
  | "empty_value"
  | "duplicate_row"
  | "non_mvp_relationship"
  | "unmapped_country_code";

export type TransformStats = {
  sourceId: string;
  rawFilesRead: string[];
  rowsRead: number;
  rowsWritten: number;
  rowsSkipped: number;
  skipReasons: Partial<Record<TransformSkipReason, number>>;
  outputPath: string;
  implemented: boolean;
  error?: string;
};

export type CanonicalMetricRow = {
  country_code: string;
  year: string;
  metric_id: string;
  value: string;
  unit: string;
  source_url: string;
  source_name: string;
  raw_record_id: string;
  calculation: string;
  notes: string;
};

export type CanonicalEventRow = {
  source_id: string;
  source_name: string;
  source_url: string;
  event_date: string;
  country_codes: string;
  actors: string;
  event_type: string;
  confidence: string;
  notes: string;
};

export const METRIC_CANONICAL_HEADERS = [
  "country_code",
  "year",
  "metric_id",
  "value",
  "unit",
  "source_url",
  "source_name",
  "raw_record_id",
  "calculation",
  "notes",
] as const;

export const EVENT_CANONICAL_HEADERS = [
  "source_id",
  "source_name",
  "source_url",
  "event_date",
  "country_codes",
  "actors",
  "event_type",
  "confidence",
  "notes",
] as const;
