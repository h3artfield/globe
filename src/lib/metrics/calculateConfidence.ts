import type { ConfidenceLevel } from "@/types/rag";
import type { MetricValue } from "@/types/pipeline";

export function calculateMetricConfidence(metric: Pick<MetricValue, "value" | "year" | "source_id">): ConfidenceLevel {
  if (metric.value === null || metric.year === null || !metric.source_id) {
    return "unknown";
  }

  return "medium";
}

export function combineMetricConfidence(metrics: MetricValue[]): ConfidenceLevel {
  if (metrics.length === 0 || metrics.some((metric) => metric.confidence === "unknown")) {
    return "unknown";
  }
  if (metrics.some((metric) => metric.confidence === "low")) {
    return "low";
  }
  if (metrics.every((metric) => metric.confidence === "high")) {
    return "high";
  }
  return "medium";
}
