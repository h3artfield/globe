import type { IndicatorRegistryEntry, MetricValue, SourceCoverageReport } from "@/types/pipeline";
import path from "node:path";
import { repoPath, writeJsonFile } from "./io";

export type ProcessedMetricsFile = {
  country_code: string;
  version: "1.0";
  generated_at: string;
  metrics: MetricValue[];
};

export function createEmptyMetric(
  countryCode: string,
  indicator: IndicatorRegistryEntry,
  retrievedAt: string,
  notes: string,
): MetricValue {
  return {
    metric_id: indicator.metric_id,
    country_code: countryCode,
    value: null,
    unit: indicator.unit,
    year: null,
    source_name: indicator.preferred_sources[0] ?? null,
    source_url: null,
    retrieved_at: retrievedAt,
    calculation: indicator.formula || null,
    confidence: "unknown",
    freshness_requirement: indicator.freshness_requirement,
    notes,
  };
}

export async function writeProcessedMetrics(
  countryCode: string,
  metrics: MetricValue[],
  generatedAt: string,
  requiredMetricIds: string[],
): Promise<void> {
  const countryDirectory = repoPath("data", "processed", "countries", countryCode);
  await writeJsonFile(path.join(countryDirectory, "metrics.v1.json"), {
    country_code: countryCode,
    version: "1.0",
    generated_at: generatedAt,
    metrics,
  } satisfies ProcessedMetricsFile);

  const availableMetricIds = metrics
    .filter((metric) => metric.value !== null && metric.year !== null)
    .map((metric) => metric.metric_id);
  const missingMetricIds = requiredMetricIds.filter(
    (metricId) => !availableMetricIds.includes(metricId),
  );

  await writeJsonFile(path.join(countryDirectory, "source_coverage.v1.json"), {
    country_code: countryCode,
    generated_at: generatedAt,
    sources_checked: Array.from(new Set(metrics.map((metric) => metric.source_name ?? "unknown"))),
    metrics_available: availableMetricIds,
    metrics_missing: missingMetricIds,
    notes: [
      "Metrics with null value/year are placeholders preserving required metadata fields.",
      "Add additional source adapters to reduce missing metric coverage.",
    ],
  } satisfies SourceCoverageReport);
}
