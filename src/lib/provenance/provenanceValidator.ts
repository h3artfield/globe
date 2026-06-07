import type { MetricValue } from "@/types/pipeline";
import { calculateFreshnessStatus } from "@/lib/metrics/calculateFreshness";

export type ProvenanceValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateMetricProvenance(
  metric: MetricValue,
  location = metric.metric_id,
): ProvenanceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!metric.source_id) {
    warnings.push(`${location}: missing source_id`);
  }
  if (metric.year === null) {
    warnings.push(`${location}: missing year`);
  }
  if (!metric.unit) {
    warnings.push(`${location}: missing unit`);
  }
  if (!metric.retrieved_at) {
    warnings.push(`${location}: missing retrieved_at`);
  }
  if (!metric.raw_file_path) {
    warnings.push(`${location}: missing raw_file_path`);
  }
  if (metric.freshness_status === "stale") {
    warnings.push(`${location}: metric older than freshness requirement`);
  }
  if (metric.source_id?.startsWith("derived_from_") && !metric.calculation) {
    warnings.push(`${location}: derived metric with missing formula`);
  }

  const expectedFreshness = calculateFreshnessStatus(
    metric.year,
    metric.freshness_requirement,
    new Date(),
  );

  if (metric.freshness_status !== expectedFreshness && expectedFreshness !== "unknown") {
    warnings.push(
      `${location}: freshness_status ${metric.freshness_status} does not match calculated ${expectedFreshness}`,
    );
  }

  return { errors, warnings };
}
