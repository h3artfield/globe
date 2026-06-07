import type { ConfidenceLevel } from "./rag";

export type FreshnessRequirement =
  | "unknown"
  | "latest_available_year"
  | "annual"
  | "monthly_or_quarterly"
  | "static_or_historical";

export type ClaimType =
  | "fact"
  | "interpretation"
  | "adversary_narrative"
  | "strategic_inference"
  | "scenario";

export type MetricValue = {
  metric_id: string;
  country_code: string;
  value: number | string | boolean | null;
  unit: string | null;
  year: number | null;
  source_name: string | null;
  source_url: string | null;
  retrieved_at: string | null;
  calculation: string | null;
  confidence: ConfidenceLevel;
  freshness_requirement: FreshnessRequirement;
  notes: string;
};

export type CountryClaim = {
  claim_id: string;
  text: string;
  claim_type: ClaimType;
  source_ids: string[];
  confidence: ConfidenceLevel;
  last_verified: string;
  notes: string;
};

export type CountryModule = {
  country_code: string;
  module: string;
  version: string;
  last_updated: string;
  summary: string;
  key_findings: string[];
  metrics: MetricValue[];
  claims: CountryClaim[];
  open_questions: string[];
  source_ids: string[];
  confidence: {
    overall: ConfidenceLevel;
    weak_areas: string[];
  };
};

export type RelationshipModule = {
  relationship_id: string;
  countries: [string, string];
  module: string;
  version: string;
  last_updated: string;
  summary: string;
  key_findings: string[];
  metrics: MetricValue[];
  claims: CountryClaim[];
  open_questions: string[];
  source_ids: string[];
  confidence: {
    overall: ConfidenceLevel;
    weak_areas: string[];
  };
};

export type RagChunk = {
  chunk_id: string;
  country_code: string | null;
  relationship_id: string | null;
  module: string;
  text: string;
  tags: string[];
  source_ids: string[];
  claim_type: ClaimType;
  year_range: [number, number] | null;
  freshness: FreshnessRequirement;
  confidence: ConfidenceLevel;
};

export type CoverageReport = {
  country_code: string;
  coverage_score: number | null;
  modules_complete: string[];
  modules_partial: string[];
  modules_missing: string[];
  metrics_available: string[];
  metrics_missing: string[];
  outdated_metrics: string[];
  low_confidence_claims: string[];
  recommended_next_sources: string[];
};

export type RelationshipCoverageReport = Omit<CoverageReport, "country_code"> & {
  relationship_id: string;
  countries: [string, string];
};

export type SourceCoverageReport = {
  country_code: string;
  generated_at: string;
  sources_checked: string[];
  metrics_available: string[];
  metrics_missing: string[];
  notes: string[];
};

export type SourceRegistryEntry = {
  source_id: string;
  name: string;
  type: "api" | "download" | "manual" | "dataset";
  base_url: string;
  license: string;
  coverage: string;
  refresh_frequency: string;
  priority: number;
  notes: string;
};

export type IndicatorRegistryEntry = {
  metric_id: string;
  label: string;
  module: string;
  preferred_sources: string[];
  unit: string;
  freshness_requirement: FreshnessRequirement;
  formula: string;
  required: boolean;
  source_indicator_code?: string;
};
