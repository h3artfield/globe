import type { MetricValue } from "@/types/pipeline";
import { buildMetricWithProvenance } from "@/lib/provenance/provenanceBuilder";
import { buildDerivedSourceId } from "@/lib/provenance/sourceId";
import { buildRawRecordId } from "@/lib/provenance/sourceRecord";
import { calculateFreshnessStatus } from "./calculateFreshness";
import { combineMetricConfidence } from "./calculateConfidence";

export function calculatePerCapita(
  numerator: MetricValue,
  population: MetricValue,
  outputMetricId: string,
): MetricValue | null {
  if (typeof numerator.value !== "number" || typeof population.value !== "number" || population.value === 0) {
    return null;
  }

  const year = numerator.year === population.year ? numerator.year : Math.min(numerator.year ?? 0, population.year ?? 0);
  const sourceId = buildDerivedSourceId(numerator.source_id ?? "unknown");

  return buildMetricWithProvenance({
    metric_id: outputMetricId,
    country_code: numerator.country_code,
    value: numerator.value / population.value,
    unit: `${numerator.unit ?? "value"}_per_person`,
    year: year || null,
    source_id: sourceId,
    source_name: "Derived metric",
    source_url: numerator.source_url ?? population.source_url ?? "",
    retrieved_at: new Date().toISOString(),
    raw_file_path: numerator.raw_file_path ?? population.raw_file_path ?? "",
    raw_record_id: buildRawRecordId([outputMetricId, numerator.raw_record_id ?? "", population.raw_record_id ?? ""]),
    calculation: `${numerator.metric_id} / ${population.metric_id}`,
    input_metric_ids: [numerator.metric_id, population.metric_id],
    confidence: combineMetricConfidence([numerator, population]),
    freshness_requirement: numerator.freshness_requirement,
    freshness_status: calculateFreshnessStatus(year || null, numerator.freshness_requirement),
    notes: "Derived per-capita metric. Inputs retain their own provenance records.",
  });
}
