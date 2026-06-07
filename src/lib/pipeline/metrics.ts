import type { IndicatorRegistryEntry, MetricValue, SourceCoverageReport } from "@/types/pipeline";
import path from "node:path";
import { mergeMetrics } from "@/lib/metrics/mergeMetrics";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "./io";

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
    source_id: indicator.preferred_sources[0] ?? null,
    source_name: indicator.preferred_sources[0] ?? null,
    source_url: null,
    retrieved_at: retrievedAt,
    raw_file_path: null,
    raw_record_id: null,
    calculation: indicator.formula || null,
    confidence: "unknown",
    freshness_requirement: indicator.freshness_requirement,
    freshness_status: "unknown",
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
  const metricsPath = path.join(countryDirectory, "metrics.v1.json");
  const existingMetrics = (await pathExists(metricsPath))
    ? (await readJsonFile<ProcessedMetricsFile>(metricsPath)).metrics.filter((metric) => metric.source_id)
    : [];
  const mergedMetrics = mergeMetrics(existingMetrics, metrics);

  await writeJsonFile(path.join(countryDirectory, "metrics.v1.json"), {
    country_code: countryCode,
    version: "1.0",
    generated_at: generatedAt,
    metrics: mergedMetrics,
  } satisfies ProcessedMetricsFile);

  const availableMetricIds = mergedMetrics
    .filter((metric) => metric.value !== null && metric.year !== null)
    .map((metric) => metric.metric_id);
  const missingMetricIds = requiredMetricIds.filter(
    (metricId) => !availableMetricIds.includes(metricId),
  );

  await writeJsonFile(path.join(countryDirectory, "source_coverage.v1.json"), {
    country_code: countryCode,
    generated_at: generatedAt,
    sources_checked: Array.from(new Set(mergedMetrics.map((metric) => metric.source_id ?? "unknown"))),
    metrics_available: availableMetricIds,
    metrics_missing: missingMetricIds,
    notes: [
      "Metrics with null value/year are placeholders preserving required metadata fields.",
      "Add additional source adapters to reduce missing metric coverage.",
    ],
  } satisfies SourceCoverageReport);
}
