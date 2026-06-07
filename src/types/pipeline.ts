import type { ConfidenceLevel } from "./rag";

export type FreshnessRequirement =
  | "unknown"
  | "latest_available_year"
  | "annual"
  | "monthly_or_quarterly"
  | "static_or_historical";

export type FreshnessStatus = "fresh" | "acceptable" | "stale" | "unknown";

export type GenerationStatus =
  | "auto_generated_structured_data"
  | "human_reviewed"
  | "llm_drafted_not_reviewed"
  | "verified";

export type ClaimType =
  | "fact"
  | "interpretation"
  | "adversary_narrative"
  | "strategic_inference"
  | "scenario"
  | "baseline_summary";

export type MetricValue = {
  metric_id: string;
  country_code: string;
  value: number | string | boolean | null;
  unit: string | null;
  year: number | null;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  retrieved_at: string | null;
  raw_file_path: string | null;
  raw_record_id: string | null;
  calculation: string | null;
  input_metric_ids?: string[];
  sample_size?: number | null;
  question_wording?: string | null;
  response_mapping?: string | null;
  demographic_cut?: string | null;
  demographic_group?: string | null;
  confidence: ConfidenceLevel;
  freshness_requirement: FreshnessRequirement;
  freshness_status: FreshnessStatus;
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
  generation_status?: GenerationStatus;
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
  generation_status?: GenerationStatus;
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
  source_family?: string;
  authority_rank?: string;
  can_override_official_data?: boolean;
  retrieval_priority?: number;
  metric_ids?: string[];
  claim_type: ClaimType;
  year_range: [number, number] | null;
  freshness: FreshnessRequirement;
  confidence: ConfidenceLevel;
};

export type CoverageReport = {
  country_code: string;
  coverage_score: number | null;
  structured_data_score: number | null;
  narrative_data_score: number | null;
  freshness_score: number | null;
  provenance_score: number | null;
  modules_complete: string[];
  modules_partial: string[];
  modules_missing: string[];
  metrics_available: string[];
  metrics_missing: string[];
  outdated_metrics: string[];
  low_confidence_claims: string[];
  review_queue_items: string[];
  source_family_coverage: SourceFamilyCoverage[];
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
  source_family_coverage?: SourceFamilyCoverage[];
  metrics_available: string[];
  metrics_missing: string[];
  notes: string[];
};

export type SourceFamilyCoverage = {
  source_id: string;
  status: "available" | "partial" | "missing" | "not_applicable";
  metrics_available: string[];
  metrics_missing: string[];
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

export type ReviewQueueItem = {
  review_id: string;
  country_code?: string;
  relationship_id?: string;
  module: string;
  reason: string;
  required_questions: string[];
  suggested_sources: string[];
  status: "pending" | "in_review" | "completed";
  generation_status: GenerationStatus;
  created_at: string;
};

export type SourceConfig = {
  source_id: string;
  mode: "api" | "manual_file" | "hybrid";
  api_base_url: string;
  manual_import_dir: string;
  raw_output_dir: string;
  requires_api_key: boolean;
  env_key_name: string;
  notes: string;
};
