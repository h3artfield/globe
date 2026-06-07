import type { CountryClaim, MetricValue } from "@/types/pipeline";
import { classifyMetricClaim } from "./claimClassifier";
import { reviewStatusForMetric } from "./reviewStatus";

export function claimFromMetric(countryCode: string, moduleName: string, metric: MetricValue, index: number): CountryClaim {
  const value = metric.value === null ? "missing" : String(metric.value);
  const year = metric.year === null ? "unknown year" : String(metric.year);

  return {
    claim_id: `${countryCode}-${moduleName}-metric-${String(index + 1).padStart(3, "0")}`,
    text: `${metric.metric_id} is ${value} ${metric.unit ?? ""} for ${countryCode} (${year}).`,
    claim_type: classifyMetricClaim(metric),
    source_ids: metric.source_id ? [metric.source_id] : [],
    confidence: metric.confidence,
    review_status: reviewStatusForMetric(metric),
    last_verified: metric.retrieved_at?.slice(0, 10) ?? "",
    notes: [
      metric.source_url ? `source_url=${metric.source_url}` : "",
      metric.raw_file_path ? `raw_file_path=${metric.raw_file_path}` : "",
      metric.raw_record_id ? `raw_record_id=${metric.raw_record_id}` : "",
      `metric_id=${metric.metric_id}`,
    ]
      .filter(Boolean)
      .join("; "),
  };
}
