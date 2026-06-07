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
