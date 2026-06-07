import type { MetricValue, ReviewStatus } from "@/types/pipeline";

export function reviewStatusForMetric(metric: MetricValue): ReviewStatus {
  return metric.source_id && metric.year !== null && metric.unit
    ? "auto_generated_from_structured_data"
    : "needs_better_sources";
}

export function strongerReviewStatus(status?: ReviewStatus): number {
  switch (status) {
    case "verified":
      return 6;
    case "human_reviewed":
      return 5;
    case "auto_generated_from_structured_data":
      return 4;
    case "llm_drafted_unreviewed":
      return 3;
    case "human_review_pending":
      return 2;
    case "needs_better_sources":
      return 1;
    case "rejected":
      return 0;
    default:
      return 0;
  }
}
