import type { MetricValue } from "@/types/pipeline";
import { buildMetricWithProvenance } from "@/lib/provenance/provenanceBuilder";
import { buildDerivedSourceId } from "@/lib/provenance/sourceId";
import { buildRawRecordId } from "@/lib/provenance/sourceRecord";
import { calculateFreshnessStatus } from "./calculateFreshness";
import { combineMetricConfidence } from "./calculateConfidence";

export function calculateWorldShare(
  countryMetric: MetricValue,
  worldMetric: MetricValue,
  outputMetricId: string,
): MetricValue | null {
  if (typeof countryMetric.value !== "number" || typeof worldMetric.value !== "number" || worldMetric.value === 0) {
    return null;
  }

  return buildMetricWithProvenance({
    metric_id: outputMetricId,
    country_code: countryMetric.country_code,
    value: (countryMetric.value / worldMetric.value) * 100,
    unit: "percent",
    year: countryMetric.year,
    source_id: buildDerivedSourceId(countryMetric.source_id ?? "unknown"),
    source_name: "Derived metric",
    source_url: countryMetric.source_url ?? worldMetric.source_url ?? "",
    retrieved_at: new Date().toISOString(),
    raw_file_path: countryMetric.raw_file_path ?? worldMetric.raw_file_path ?? "",
    raw_record_id: buildRawRecordId([outputMetricId, countryMetric.raw_record_id ?? "", worldMetric.raw_record_id ?? ""]),
    calculation: `${countryMetric.metric_id} / world_total(${worldMetric.metric_id}) * 100`,
    input_metric_ids: [countryMetric.metric_id, worldMetric.metric_id],
    confidence: combineMetricConfidence([countryMetric, worldMetric]),
    freshness_requirement: countryMetric.freshness_requirement,
    freshness_status: calculateFreshnessStatus(countryMetric.year, countryMetric.freshness_requirement),
    notes: "Derived world-share metric. Denominator is the supplied world total metric.",
  });
}
