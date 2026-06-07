import type { ConfidenceLevel } from "@/types/rag";
import type { FreshnessRequirement, FreshnessStatus, MetricValue } from "@/types/pipeline";
import type { SourceRecordReference } from "./sourceRecord";

type BuildMetricInput = SourceRecordReference & {
  metric_id: string;
  country_code: string;
  value: MetricValue["value"];
  unit: string | null;
  year: number | null;
  calculation: string | null;
  input_metric_ids?: string[];
  confidence: ConfidenceLevel;
  freshness_requirement: FreshnessRequirement;
  freshness_status: FreshnessStatus;
  notes: string;
};

export function buildMetricWithProvenance(input: BuildMetricInput): MetricValue {
  return {
    metric_id: input.metric_id,
    country_code: input.country_code,
    value: input.value,
    unit: input.unit,
    year: input.year,
    source_id: input.source_id,
    source_name: input.source_name,
    source_url: input.source_url,
    retrieved_at: input.retrieved_at,
    raw_file_path: input.raw_file_path,
    raw_record_id: input.raw_record_id,
    calculation: input.calculation,
    input_metric_ids: input.input_metric_ids,
    confidence: input.confidence,
    freshness_requirement: input.freshness_requirement,
    freshness_status: input.freshness_status,
    notes: input.notes,
  };
}
