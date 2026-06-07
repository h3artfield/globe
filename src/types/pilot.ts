import type { AskResponse } from "./api";

export type SourcePackSource = {
  source_id: string;
  source_type: "official_primary" | "international_dataset" | "academic" | "think_tank" | "major_news" | "local_news" | "wikipedia" | "manual_note";
  title: string;
  publisher: string;
  url: string;
  retrieved_at: string;
  file_path: string;
  covers_modules: string[];
  authority_rank: string;
  notes: string;
};

export type SourcePack = {
  source_pack_id: string;
  country_code?: string;
  relationship_id: string | null;
  last_updated: string;
  sources: SourcePackSource[];
};

export type PilotCompletionScore = {
  scope_id: string;
  structured_metrics_coverage: number;
  narrative_module_coverage: number;
  event_timeline_coverage: number;
  relationship_coverage: number;
  citation_quality: number;
  review_quality: number;
  retrieval_quality: number;
  overall_pilot_readiness: number;
  notes: string[];
};

export type AnswerAuditRecord = {
  audit_id: string;
  created_at: string;
  question: string;
  selectedCountries: string[];
  modules_used: string[];
  chunks_used: unknown[];
  metrics_used: unknown[];
  events_used: unknown[];
  citations: unknown[];
  review_status_summary: Record<string, number>;
  missing_data: string[];
  warning_badges: string[];
  retrieval_debug: unknown;
  answer: string;
  response?: AskResponse;
};

export type ModuleSourceRequirement = {
  module: string;
  minimum_sources: number;
  required_source_types: SourcePackSource["source_type"][];
  required_claim_types: string[];
  freshness_requirement: string;
  minimum_claim_count: number;
  minimum_metric_count: number;
  required_review_status_level: string;
  completion_threshold: number;
};

export type SourceRequirementsFile = {
  target_id: string;
  target_type: "country" | "relationship";
  last_updated: string;
  modules: ModuleSourceRequirement[];
};

export type ModuleSourceGap = {
  module: string;
  readiness: number;
  sources_available: number;
  sources_required: number;
  missing_source_types: string[];
  missing_claim_types: string[];
  recommendation: string;
};

export type SourceGapReport = {
  target_id: string;
  target_type: "country" | "relationship";
  overall_source_readiness: number;
  modules: ModuleSourceGap[];
};

export type EnhancedSourceRequest = {
  request_id: string;
  country_code?: string;
  relationship_id?: string;
  module: string;
  priority: "low" | "medium" | "high";
  missing_questions: string[];
  missing_source_types: string[];
  suggested_source_types: string[];
  suggested_search_queries: string[];
  suggested_document_types: string[];
  why_it_matters: string;
  status: "open" | "in_progress" | "closed";
};

export type PilotReadinessReport = {
  target_id: string;
  pilot_ready: boolean;
  overall_score: number;
  failed_gates: string[];
  next_actions: string[];
};
