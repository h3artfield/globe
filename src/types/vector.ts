import type { MetricValue, RagChunk, RelationshipModule } from "./pipeline";
import type { WorldEvent } from "./worldModel";

export type AuthorityRank =
  | "primary"
  | "international_dataset"
  | "institutional"
  | "news"
  | "wikipedia"
  | "manual";

export type EmbeddedChunk = {
  chunk_id: string;
  embedding: number[];
  text: string;
  country_code: string | null;
  relationship_id: string | null;
  module: string;
  source_ids: string[];
  claim_type: string;
  confidence: string;
  authority_rank: AuthorityRank;
  can_override_official_data: boolean;
  year_range: [number, number] | null;
};

export type RetrievalScoreInput = {
  semanticScore: number;
  keywordScore: number;
  moduleRelevanceScore: number;
  sourceAuthorityScore: number;
  freshnessScore: number;
  confidenceScore: number;
  eventImportanceScore?: number;
  selectedCountryBoost: number;
  selectedRelationshipBoost?: number;
};

export type ScoredChunk = {
  chunk: RagChunk;
  score: number;
  scoring: RetrievalScoreInput;
};

export type Citation = {
  source_id: string;
  source_name?: string | null;
  source_url?: string | null;
  retrieved_at?: string | null;
  raw_file_path?: string | null;
  module?: string;
  chunk_id?: string;
  metric_id?: string;
  event_id?: string;
  country_code?: string | null;
  relationship_id?: string | null;
  confidence?: string;
  review_status?: string;
};

export type MissingDataWarning = {
  scope: string;
  message: string;
  severity: "info" | "warning";
};

export type RetrievalDebugInfo = {
  question_type: string;
  selected_modules: string[];
  candidate_chunks: string[];
  final_chunks: string[];
  scoring_breakdown: Array<{
    chunk_id: string;
    score: number;
    scoring: RetrievalScoreInput;
  }>;
  dropped_candidates: string[];
};

export type RetrievalContext = {
  questionType: string;
  selectedModules: string[];
  retrievedChunks: RagChunk[];
  retrievedMetrics: MetricValue[];
  retrievedEvents: WorldEvent[];
  retrievedRelationships: RelationshipModule[];
  citations: Citation[];
  missingData: MissingDataWarning[];
  retrievalDebug: RetrievalDebugInfo;
};
