import type {
  CountryModule,
  CoverageReport,
  IndicatorRegistryEntry,
  RelationshipCoverageReport,
  RelationshipModule,
} from "@/types/pipeline";
import { COUNTRY_MODULES, RELATIONSHIP_MODULES } from "./constants";

export function buildCountryCoverageReport(
  countryCode: string,
  modules: CountryModule[],
  indicators: IndicatorRegistryEntry[],
): CoverageReport {
  const modulesComplete = modules
    .filter((module) => module.metrics.length > 0 && module.claims.length > 0)
    .map((module) => module.module);
  const modulesPartial = modules
    .filter((module) => module.metrics.length > 0 || module.claims.length > 0)
    .map((module) => module.module)
    .filter((module) => !modulesComplete.includes(module));
  const modulesMissing = COUNTRY_MODULES.filter(
    (module) => !modulesComplete.includes(module) && !modulesPartial.includes(module),
  );
  const metricsAvailable = modules.flatMap((module) =>
    module.metrics
      .filter((metric) => metric.value !== null && metric.year !== null)
      .map((metric) => metric.metric_id),
  );
  const metricsMissing = indicators
    .filter((indicator) => indicator.required && !metricsAvailable.includes(indicator.metric_id))
    .map((indicator) => indicator.metric_id);
  const lowConfidenceClaims = modules.flatMap((module) =>
    module.claims
      .filter((claim) => claim.confidence === "low" || claim.confidence === "unknown")
      .map((claim) => claim.claim_id),
  );
  const possibleCoverageItems = COUNTRY_MODULES.length + indicators.length;
  const coveredItems = modulesComplete.length + modulesPartial.length * 0.5 + metricsAvailable.length;

  return {
    country_code: countryCode,
    coverage_score:
      possibleCoverageItems > 0 ? Math.round((coveredItems / possibleCoverageItems) * 100) : null,
    modules_complete: modulesComplete,
    modules_partial: modulesPartial,
    modules_missing: [...modulesMissing],
    metrics_available: Array.from(new Set(metricsAvailable)).sort(),
    metrics_missing: Array.from(new Set(metricsMissing)).sort(),
    outdated_metrics: [],
    low_confidence_claims: lowConfidenceClaims,
    recommended_next_sources: [
      "manual_history_sources",
      "manual_leader_sources",
      "world_values_survey",
      "un_comtrade",
      "unodc",
      "vdem",
    ],
  };
}

export function buildRelationshipCoverageReport(
  relationshipId: string,
  modules: RelationshipModule[],
): RelationshipCoverageReport {
  const modulesPartial = modules
    .filter((module) => module.metrics.length > 0 || module.claims.length > 0 || module.summary)
    .map((module) => module.module);
  const modulesMissing = RELATIONSHIP_MODULES.filter((module) => !modulesPartial.includes(module));

  return {
    relationship_id: relationshipId,
    countries: relationshipId.split("_") as [string, string],
    coverage_score:
      modulesPartial.length > 0
        ? Math.round((modulesPartial.length / RELATIONSHIP_MODULES.length) * 100)
        : 0,
    modules_complete: [],
    modules_partial: modulesPartial,
    modules_missing: [...modulesMissing],
    metrics_available: [],
    metrics_missing: [],
    outdated_metrics: [],
    low_confidence_claims: [],
    recommended_next_sources: ["un_comtrade", "manual_history_sources", "manual_leader_sources"],
  };
}
