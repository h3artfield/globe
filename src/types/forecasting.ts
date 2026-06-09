export type ForecastMode = "historical_replay" | "live" | "short_cycle";

export type ForecastTargetType = "country" | "relationship";

export type ForecastTarget = {
  target_type: ForecastTargetType;
  target_id: string;
};

export type AsOfCutoff = {
  as_of_year: number;
  as_of_date: string;
};

export type LeakageStatus = "passed" | "failed";

export type EvidenceSourceType =
  | "processed_metric"
  | "world_model_event"
  | "canonical_metric_row"
  | "canonical_event_row"
  | "replay_template_hint";

export type ForecastEvidenceItem = {
  evidence_id: string;
  source_type: EvidenceSourceType;
  source_id: string;
  observation_year: number | null;
  observation_date: string | null;
  metric_id?: string;
  event_id?: string;
  label: string;
  value_summary: string;
  file_path: string;
  raw_record_id?: string;
};

export type ForecastStatus =
  | "draft"
  | "evidence_gathering"
  | "submitted"
  | "resolved"
  | "void";

export type ResolutionSpec =
  | {
      kind: "metric_compare_years";
      metric_id: string;
      source_id: string;
      baseline_year_from_as_of: boolean;
      resolution_year: number;
      comparator: "gt" | "gte" | "lt" | "lte";
      relationship_id?: string;
      aggregate?: "sum_imports_exports";
    }
  | {
      kind: "metric_threshold";
      metric_id: string;
      source_id: string;
      year: number;
      threshold: number;
      comparator: "gt" | "gte" | "lt" | "lte";
    }
  | {
      kind: "event_exists";
      source_id: string;
      event_type: string;
      window_start: string;
      window_end: string;
    };

export type ReplayTemplate = {
  template_id: string;
  version: "1.0";
  mode: "historical_replay";
  title: string;
  description: string;
  target_type: ForecastTargetType;
  allowed_targets: string[];
  default_as_of_year: number;
  resolution_year: number;
  question_template: string;
  resolution_spec: ResolutionSpec;
  allowed_evidence_sources: EvidenceSourceType[];
  allowed_source_ids: string[];
  limitations: string;
};

export type LeakageRejectedItem = {
  evidence_id: string;
  source_type: EvidenceSourceType;
  observation_date: string | null;
  observation_year: number | null;
  reason: "future_date" | "future_year" | "disallowed_source" | "missing_provenance";
};

export type LeakageAudit = {
  forecast_id: string;
  as_of_cutoff: AsOfCutoff;
  audited_at: string;
  newest_evidence_date_used: string | null;
  evidence_count: number;
  rejected_future_evidence_count: number;
  leakage_status: LeakageStatus;
  rejected_items: LeakageRejectedItem[];
  notes: string;
};

export type ForecastRecord = {
  forecast_id: string;
  session_id: string;
  mode: ForecastMode;
  template_id: string;
  target: ForecastTarget;
  as_of_cutoff: AsOfCutoff;
  question_text: string;
  probability: number;
  rationale: string;
  evidence: ForecastEvidenceItem[];
  status: ForecastStatus;
  created_at: string;
  submitted_at: string | null;
  leakage_audit_id: string | null;
  resolution_id: string | null;
  scorecard_id: string | null;
};

export type BrierScore = {
  probability: number;
  outcome: 0 | 1;
  brier: number;
};

export type ForecastScorecard = {
  scorecard_id: string;
  forecast_id: string;
  brier: BrierScore;
  leakage_status: LeakageStatus;
  evidence_count: number;
  source_discipline_score: number | null;
  agent_ids: string[];
  computed_at: string;
};

export type ReplayTemplateListResponse = {
  templates: ReplayTemplate[];
  count: number;
};

export type ReplaySessionStatus = "draft" | "locked" | "resolved";

export type ReplaySessionAuditEntry = {
  at: string;
  action: string;
  details?: string;
};

export type ReplayForecastConfidence = "low" | "medium" | "high";

export type ReplayUserForecast = {
  probability: number | null;
  confidence: ReplayForecastConfidence | null;
  rationale: string;
};

export type ReplaySession = {
  session_id: string;
  template_id: string;
  created_at: string;
  locked_at: string | null;
  target: ForecastTarget;
  forecast_year: number;
  resolution_year: number;
  question_text: string;
  resolution_spec: ResolutionSpec;
  allowed_source_ids: string[];
  status: ReplaySessionStatus;
  user_forecast: ReplayUserForecast;
  evidence_snapshot_id: string | null;
  resolution_id: string | null;
  audit_trail: ReplaySessionAuditEntry[];
};

export type UpdateReplaySessionDraftRequest = {
  probability?: number | null;
  confidence?: ReplayForecastConfidence | null;
  rationale?: string;
};

export type CreateReplaySessionRequest = {
  template_id: string;
  target: string;
  year: number;
};

export type ReplaySessionListResponse = {
  sessions: ReplaySession[];
  count: number;
};

export type ReplayEvidenceIncludedRecord = {
  record_id: string;
  source_id: string;
  label: string;
  year: number | null;
  date: string | null;
  value_summary: string;
};

export type ReplayEvidenceSnapshot = {
  evidence_snapshot_id: string;
  session_id: string;
  template_id: string;
  created_at: string;
  as_of_year: number;
  allowed_source_ids: string[];
  included_records: ReplayEvidenceIncludedRecord[];
  missing_sources: string[];
  excluded_future_records_count: number;
  summary: string;
  limitations: string;
  source_paths: string[];
  confidence: ReplayForecastConfidence;
};

export type ReplayResolutionOutcome = "yes" | "no" | "missing_evidence" | "void";

export type ReplayResolutionSourceRecord = {
  record_id: string;
  source_id: string;
  label: string;
  year: number | null;
  date: string | null;
  value_summary: string;
};

export type ReplayResolution = {
  resolution_id: string;
  session_id: string;
  template_id: string;
  created_at: string;
  resolution_year: number;
  outcome: ReplayResolutionOutcome;
  resolved_value: number | boolean | null;
  prior_value: number | boolean | null;
  comparison_value: number | boolean | null;
  source_records: ReplayResolutionSourceRecord[];
  source_paths: string[];
  confidence: ReplayForecastConfidence;
  limitations: string;
};
