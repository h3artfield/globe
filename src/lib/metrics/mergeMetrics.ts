import type { MetricValue } from "@/types/pipeline";

export function metricMergeKey(metric: MetricValue): string {
  return [
    metric.country_code,
    metric.metric_id,
    metric.year ?? "unknown_year",
    metric.source_id ?? "unknown_source",
  ].join("|");
}

export function mergeMetrics(existingMetrics: MetricValue[], incomingMetrics: MetricValue[]): MetricValue[] {
  const merged = new Map<string, MetricValue>();

  for (const metric of existingMetrics) {
    merged.set(metricMergeKey(metric), metric);
  }

  for (const metric of incomingMetrics) {
    merged.set(metricMergeKey(metric), metric);
  }

  return Array.from(merged.values()).sort((a, b) =>
    `${a.country_code}:${a.metric_id}:${a.year ?? 0}:${a.source_id ?? ""}`.localeCompare(
      `${b.country_code}:${b.metric_id}:${b.year ?? 0}:${b.source_id ?? ""}`,
    ),
  );
}
