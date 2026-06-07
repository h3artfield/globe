import type { CountryModule, RagChunk, RelationshipModule } from "@/types/pipeline";
import { MODULE_TOPIC_TAGS } from "./constants";

function getYearRange(module: CountryModule | RelationshipModule): [number, number] | null {
  const years = module.metrics
    .map((metric) => metric.year)
    .filter((year): year is number => typeof year === "number")
    .sort();

  if (years.length === 0) {
    return null;
  }

  return [years[0], years[years.length - 1]];
}

function getFreshness(module: CountryModule | RelationshipModule) {
  return module.metrics[0]?.freshness_requirement ?? "unknown";
}

export function buildCountryChunk(module: CountryModule, sequence: number): RagChunk {
  const metricSummary =
    module.metrics.length > 0
      ? module.metrics
          .map(
            (metric) =>
              `${metric.metric_id}=${metric.value ?? "missing"} ${metric.unit ?? ""} (${metric.year ?? "year unknown"}, source=${metric.source_name ?? "unknown"})`,
          )
          .join("; ")
      : "No sourced metrics are available yet.";
  const claimSummary =
    module.claims.length > 0
      ? module.claims.map((claim) => claim.text).join(" ")
      : "No narrative claims have been added because every important claim requires source metadata.";

  return {
    chunk_id: `${module.country_code}-${module.module}-${String(sequence).padStart(3, "0")}`,
    country_code: module.country_code,
    relationship_id: null,
    module: module.module,
    text: [module.summary, metricSummary, claimSummary].filter(Boolean).join("\n"),
    tags: MODULE_TOPIC_TAGS[module.module] ?? [`country-${module.module}`],
    source_ids: module.source_ids,
    claim_type: module.claims[0]?.claim_type ?? "fact",
    year_range: getYearRange(module),
    freshness: getFreshness(module),
    confidence: module.confidence.overall,
  };
}

export function buildRelationshipChunk(module: RelationshipModule, sequence: number): RagChunk {
  return {
    chunk_id: `${module.relationship_id}-${module.module}-${String(sequence).padStart(3, "0")}`,
    country_code: null,
    relationship_id: module.relationship_id,
    module: module.module,
    text:
      module.summary ||
      `No sourced ${module.module} relationship narrative has been added yet. Claims and metrics must include metadata before use.`,
    tags: MODULE_TOPIC_TAGS[module.module] ?? [`relationship-${module.module}`],
    source_ids: module.source_ids,
    claim_type: module.claims[0]?.claim_type ?? "fact",
    year_range: getYearRange(module),
    freshness: getFreshness(module),
    confidence: module.confidence.overall,
  };
}
