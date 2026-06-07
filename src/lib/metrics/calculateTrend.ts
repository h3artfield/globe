import type { MetricValue } from "@/types/pipeline";
import { buildMetricWithProvenance } from "@/lib/provenance/provenanceBuilder";
import { buildDerivedSourceId } from "@/lib/provenance/sourceId";
import { buildRawRecordId } from "@/lib/provenance/sourceRecord";
import { calculateFreshnessStatus } from "./calculateFreshness";
import { combineMetricConfidence } from "./calculateConfidence";

type TrendMode = "absolute_change" | "percent_change";

export function calculateTrend(
  latestMetric: MetricValue,
  previousMetric: MetricValue,
  outputMetricId: string,
  mode: TrendMode = "absolute_change",
): MetricValue | null {
  if (typeof latestMetric.value !== "number" || typeof previousMetric.value !== "number") {
    return null;
  }

  if (mode === "percent_change" && previousMetric.value === 0) {
    return null;
  }

  const value =
    mode === "percent_change"
      ? ((latestMetric.value - previousMetric.value) / previousMetric.value) * 100
      : latestMetric.value - previousMetric.value;
  const formula =
    mode === "percent_change"
      ? `(${latestMetric.metric_id}[latest] - ${previousMetric.metric_id}[previous]) / ${previousMetric.metric_id}[previous] * 100`
      : `${latestMetric.metric_id}[latest] - ${previousMetric.metric_id}[previous]`;

  return buildMetricWithProvenance({
    metric_id: outputMetricId,
    country_code: latestMetric.country_code,
    value,
    unit: mode === "percent_change" ? "percent" : latestMetric.unit,
    year: latestMetric.year,
    source_id: buildDerivedSourceId(latestMetric.source_id ?? "unknown"),
    source_name: "Derived metric",
    source_url: latestMetric.source_url ?? previousMetric.source_url ?? "",
    retrieved_at: new Date().toISOString(),
    raw_file_path: latestMetric.raw_file_path ?? previousMetric.raw_file_path ?? "",
    raw_record_id: buildRawRecordId([outputMetricId, latestMetric.raw_record_id ?? "", previousMetric.raw_record_id ?? ""]),
    calculation: formula,
    input_metric_ids: [latestMetric.metric_id, previousMetric.metric_id],
    confidence: combineMetricConfidence([latestMetric, previousMetric]),
    freshness_requirement: latestMetric.freshness_requirement,
    freshness_status: calculateFreshnessStatus(latestMetric.year, latestMetric.freshness_requirement),
    notes: "Derived trend metric. Use input metrics for source-specific provenance.",
  });
}
