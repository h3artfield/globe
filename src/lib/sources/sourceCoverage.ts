import type { MetricValue, SourceFamilyCoverage } from "@/types/pipeline";
import { getSourceMetricDefinitions } from "./sourceMetricDefinitions";

export function buildSourceFamilyCoverage(
  sourceId: string,
  metrics: MetricValue[],
): SourceFamilyCoverage {
  const definitions = getSourceMetricDefinitions(sourceId);
  const sourceMetrics = metrics.filter((metric) => metric.source_id === sourceId);
  const available = Array.from(new Set(sourceMetrics.map((metric) => metric.metric_id))).sort();
  const required = definitions.filter((definition) => definition.required).map((definition) => definition.metric_id);
  const missing = required.filter((metricId) => !available.includes(metricId)).sort();

  return {
    source_id: sourceId,
    status:
      available.length === 0
        ? "missing"
        : missing.length === 0
          ? "available"
          : "partial",
    metrics_available: available,
    metrics_missing: missing,
  };
}
