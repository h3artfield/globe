import type { ModuleSourceRequirement } from "./pilot";

export type KbTargetType = "country" | "relationship";

export type ModuleCompletionStatus = "complete" | "partial" | "missing" | "stub";

export type CollectionStatus = "needed" | "found" | "imported" | "rejected";

export type KbSourceType =
  | "official_primary"
  | "international_dataset"
  | "treaty"
  | "think_tank"
  | "major_news"
  | "dataset"
  | "academic";

export type CountrySourceRequirementsFile = {
  target_id: string;
  target_type: "country";
  last_updated: string;
  country_topics?: string[];
  modules: ModuleSourceRequirement[];
};

export type RelationshipSourceRequirementsFile = {
  target_id: string;
  target_type: "relationship";
  last_updated: string;
  coverage_topics: string[];
  modules: ModuleSourceRequirement[];
};

export type NextBestSource = {
  queue_id: string;
  source_title: string;
  source_org: string;
  source_type: KbSourceType;
  expected_folder: string;
  expected_filename: string;
  shared_source_id?: string;
};

export type KbModuleMatrixEntry = {
  module: string;
  status: ModuleCompletionStatus;
  required_source_categories: string[];
  existing_source_files: string[];
  missing_source_files: string[];
  readiness_score: number;
  next_best_source: NextBestSource | null;
};

export type KbTargetMatrixEntry = {
  target_id: string;
  target_type: KbTargetType;
  readiness_score: number;
  modules_complete: number;
  modules_partial: number;
  modules_missing: number;
  modules_stub: number;
  modules: KbModuleMatrixEntry[];
};

export type KbCompletionMatrix = {
  version: "1.0";
  generated_at: string;
  summary: {
    countries_tracked: number;
    relationships_tracked: number;
    average_country_readiness: number;
    average_relationship_readiness: number;
    queue_items_needed: number;
    shared_datasets_needed: number;
  };
  countries: Record<string, KbTargetMatrixEntry>;
  relationships: Record<string, KbTargetMatrixEntry>;
};

export type TargetMapping = {
  target_id: string;
  target_type: KbTargetType;
  modules: string[];
};

export type AcquisitionSlot = {
  queue_id: string;
  shared_source_id?: string;
  applies_to_targets?: string[];
  target_mappings?: TargetMapping[];
  target_id?: string;
  target_type?: KbTargetType;
  module: string;
  modules_supported?: string[];
  source_title: string;
  source_org: string;
  source_type: KbSourceType;
  expected_folder: string;
  expected_filename: string;
  priority: number;
  notes: string;
};

export type KbQueueItem = {
  queue_id: string;
  target_id: string;
  target_type: KbTargetType;
  module: string;
  source_title: string;
  source_org: string;
  source_type: KbSourceType;
  expected_folder: string;
  expected_filename: string;
  collection_status: CollectionStatus;
  priority: number;
  notes: string;
  shared_source_id?: string;
  applies_to_targets?: string[];
  target_mappings?: TargetMapping[];
  rejected_reason?: string;
};

export type KbCompletionQueue = {
  version: "1.0";
  generated_at: string;
  items: KbQueueItem[];
};

export type KbQueueOverride = {
  collection_status?: CollectionStatus;
  notes?: string;
  rejected_reason?: string;
  source_title?: string;
  source_org?: string;
  priority?: number;
};

export type KbCompletionOverrides = {
  version: "1.0";
  last_updated: string;
  overrides: Record<string, KbQueueOverride>;
};

export const KB_OVERRIDE_PRESERVE_FIELDS = [
  "collection_status",
  "notes",
  "rejected_reason",
  "source_title",
  "source_org",
  "priority",
] as const;
