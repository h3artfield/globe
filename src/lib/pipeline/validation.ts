import type { CountryModule, MetricValue, RagChunk, RelationshipModule } from "@/types/pipeline";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { validateMetricProvenance } from "@/lib/provenance/provenanceValidator";

const MODULE_SOURCE_WARNINGS: Record<string, { sourceIds: string[]; message: string }> = {
  trade_exports_imports: { sourceIds: ["un_comtrade", "unctad"], message: "trade module lacks trade data" },
  crime_safety: { sourceIds: ["unodc"], message: "crime module lacks crime data" },
  demographic_change: { sourceIds: ["un_desa_migrant_stock"], message: "demographic_change module lacks migration data" },
  nationalism_cohesion: { sourceIds: ["world_values_survey"], message: "national_cohesion module lacks survey data" },
  national_cohesion_by_demographic: { sourceIds: ["world_values_survey"], message: "national_cohesion module lacks survey data" },
  technology_contributions: { sourceIds: ["wipo"], message: "technology_contributions module lacks WIPO/patent data" },
  education: { sourceIds: ["unesco_uis", "oecd_pisa"], message: "education module lacks education/PISA/UIS data" },
  government_current: { sourceIds: ["vdem", "manual_leader_sources"], message: "government_current module lacks V-Dem or verified manual source" },
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

function mergeResults(results: ValidationResult[]): ValidationResult {
  return {
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}

export function validateMetric(metric: MetricValue, location: string): ValidationResult {
  const errors: string[] = [];

  if (!metric.country_code || !/^[A-Z]{3}$/.test(metric.country_code)) {
    errors.push(`${location}: metric has no valid country_code`);
  }
  if (metric.year === null) {
    errors.push(`${location}: metric ${metric.metric_id} has no year`);
  }
  if (!metric.source_name) {
    errors.push(`${location}: metric ${metric.metric_id} has no source`);
  }
  if (!metric.unit) {
    errors.push(`${location}: metric ${metric.metric_id} has no unit`);
  }

  const provenance = validateMetricProvenance(metric, `${location}:${metric.metric_id}`);

  return { errors: [...errors, ...provenance.errors], warnings: provenance.warnings };
}

export function validateCountryModule(module: CountryModule, location: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/^[A-Z]{3}$/.test(module.country_code)) {
    errors.push(`${location}: country folder is not ISO Alpha-3`);
  }

  for (const claim of module.claims) {
    if (!claim.claim_type) {
      errors.push(`${location}: claim ${claim.claim_id} has no claim_type`);
    }
    if (!claim.confidence) {
      errors.push(`${location}: claim ${claim.claim_id} has no confidence`);
    }
    if (claim.claim_type === "fact" && claim.notes.toLowerCase().includes("may ")) {
      warnings.push(`${location}: claim ${claim.claim_id} may be interpretive but marked fact`);
    }
  }

  if (module.module === "leader_dossiers") {
    const leaders = (module as unknown as { leaders?: { source_ids?: string[] }[] }).leaders ?? [];
    for (const [index, leader] of leaders.entries()) {
      if (!leader.source_ids || leader.source_ids.length === 0) {
        errors.push(`${location}: leader dossier ${index} has no source_ids`);
      }
    }
  }

  const sourceWarning = MODULE_SOURCE_WARNINGS[module.module];
  if (
    sourceWarning &&
    !module.metrics.some((metric) => metric.source_id && sourceWarning.sourceIds.includes(metric.source_id)) &&
    !module.source_ids.some((sourceId) => sourceWarning.sourceIds.includes(sourceId))
  ) {
    warnings.push(`${location}: ${sourceWarning.message}`);
  }

  return mergeResults([
    { errors, warnings },
    ...module.metrics.map((metric) => validateMetric(metric, location)),
  ]);
}

export function validateRelationshipModule(
  module: RelationshipModule,
  location: string,
): ValidationResult {
  const errors: string[] = [];
  const expectedRelationshipId = buildRelationshipId(module.countries[0], module.countries[1]);

  if (module.relationship_id !== expectedRelationshipId) {
    errors.push(`${location}: relationship pair is not alphabetically sorted`);
  }

  return mergeResults([
    { errors, warnings: [] },
    ...module.metrics.map((metric) => validateMetric(metric, location)),
  ]);
}

export function validateRagChunk(chunk: RagChunk, location: string): ValidationResult {
  const errors: string[] = [];

  if (!chunk.module) {
    errors.push(`${location}: RAG chunk has no module`);
  }
  if (!Array.isArray(chunk.source_ids)) {
    errors.push(`${location}: RAG chunk has no source_ids`);
  }

  return { errors, warnings: [] };
}
