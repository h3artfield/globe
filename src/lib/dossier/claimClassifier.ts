import type { ClaimType, MetricValue } from "@/types/pipeline";

export function classifyMetricClaim(metric: MetricValue): ClaimType {
  if (metric.source_id?.startsWith("derived_from_") || metric.calculation?.includes(" - ") || metric.calculation?.includes(" / ")) {
    return "metric";
  }

  return "fact";
}
