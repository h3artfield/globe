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
    }
  | {
      kind: "polymarket_market_outcome";
      source: "polymarket";
      market_id: string;
      condition_id: string | null;
      resolution_source: string;
      end_date: string | null;
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

export type ForecastAgentType = "human" | "ai" | "hybrid";

export type ForecastAgentProfile = {
  agent_id: string;
  name: string;
  type: ForecastAgentType;
  created_at: string;
  description: string;
  default_source_preferences: string[];
  calibration_summary: string;
  strengths: string[];
  weaknesses: string[];
  next_time_rules: string[];
  active: boolean;
};

export type CreateForecastAgentRequest = {
  name: string;
  type: ForecastAgentType;
  description?: string;
  default_source_preferences?: string[];
};

export type ForecastAgentListResponse = {
  agents: ForecastAgentProfile[];
  count: number;
};

export type ForecastSourceRequestType =
  | "human_upload"
  | "api_fetch"
  | "dataset_refresh"
  | "clarification";

export type ForecastSourceRequestStatus = "open" | "fulfilled" | "rejected" | "unavailable";

export type ForecastSourceRequestPriority = "low" | "medium" | "high";

export type ForecastSourceRequest = {
  source_request_id: string;
  session_id: string;
  agent_id: string | null;
  template_id: string;
  created_at: string;
  request_type: ForecastSourceRequestType;
  status: ForecastSourceRequestStatus;
  priority: ForecastSourceRequestPriority;
  requested_source_id: string;
  requested_source_name: string;
  reason: string;
  expected_value: string;
  target_country_iso3: string | null;
  relationship_pair: string | null;
  forecast_year: number;
  cutoff_year: number;
  no_future_leakage_required: boolean;
  suggested_api_adapter: string | null;
  suggested_local_path: string | null;
  human_instructions: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  fulfillment_notes: string;
  linked_evidence_snapshot_id: string | null;
  too_late_for_forecast: boolean;
  fulfillment_id: string | null;
  usable_for_original_forecast: boolean | null;
};

export type SourceFulfillmentType =
  | "human_file"
  | "local_adapter"
  | "api_adapter"
  | "note_only";

export type SourceFulfillmentRecord = {
  record_id: string;
  source_id: string;
  label: string;
  year: number | null;
  date: string | null;
  value_summary: string;
};

export type SourceFulfillmentArtifact = {
  fulfillment_id: string;
  source_request_id: string;
  session_id: string;
  agent_id: string | null;
  created_at: string;
  fulfilled_by: string;
  fulfillment_type: SourceFulfillmentType;
  source_id: string;
  local_paths: string[];
  records_found: number;
  records_usable: SourceFulfillmentRecord[];
  records_rejected: number;
  rejected_future_records_count: number;
  cutoff_year: number;
  summary: string;
  limitations: string;
  confidence: ReplayForecastConfidence;
  safe_for_evidence_snapshot: boolean;
  usable_for_original_forecast: boolean;
};

export type FulfillSourceRequestBody = {
  fulfilled_by?: string;
  fulfillment_notes?: string;
  fulfillment_type?: SourceFulfillmentType;
  adapter_id?: string;
  source_id?: string;
  local_paths?: string[];
  local_path?: string;
  cutoff_year?: number;
  safe_for_evidence_snapshot?: boolean;
  summary?: string;
  limitations?: string;
  confidence?: ReplayForecastConfidence;
  note_text?: string;
};

export type CreateSourceRequestInput = {
  request_type: ForecastSourceRequestType;
  requested_source_id: string;
  requested_source_name?: string;
  reason: string;
  expected_value?: string;
  priority?: ForecastSourceRequestPriority;
  human_instructions?: string;
  suggested_local_path?: string;
};

export type ReplayNextTimeRule = {
  rule_id: string;
  agent_id: string;
  session_id: string;
  template_id: string;
  source_family: string;
  mistake_type: string;
  rule_text: string;
  created_at: string;
};

export type AgentCalibrationBucket = {
  bucket: "0-20" | "21-40" | "41-60" | "61-80" | "81-100";
  count: number;
  average_brier: number | null;
};

export type AgentPerformanceSummary = {
  agent_id: string;
  computed_at: string;
  total_forecasts: number;
  resolved_forecasts: number;
  average_brier_score: number | null;
  direction_accuracy: number | null;
  calibration_buckets: AgentCalibrationBucket[];
  performance_by_template_id: Record<
    string,
    { count: number; average_brier: number | null; direction_accuracy: number | null }
  >;
  performance_by_source_family: Record<
    string,
    { count: number; average_brier: number | null }
  >;
  common_judge_warnings: string[];
  repeated_missed_signals: string[];
  recommended_next_time_rules: string[];
};

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
  agent_id: string | null;
  agent_name: string | null;
  agent_type: ForecastAgentType | null;
  forecast_rationale: string;
  key_signals: string[];
  assumptions: string[];
  uncertainty_notes: string;
  requested_sources: string[];
  source_request_ids: string[];
  postmortem_rule_ids: string[];
  evidence_snapshot_id: string | null;
  resolution_id: string | null;
  scorecard_id: string | null;
  judge_audit_id: string | null;
  postmortem_id: string | null;
  audit_trail: ReplaySessionAuditEntry[];
  forecast_mode: ForecastMode;
  source_question_id: string | null;
  source_market_id: string | null;
  external_source: "polymarket" | null;
  external_source_url: string | null;
};

export type UpdateReplaySessionDraftRequest = {
  probability?: number | null;
  confidence?: ReplayForecastConfidence | null;
  rationale?: string;
  forecast_rationale?: string;
  key_signals?: string[];
  assumptions?: string[];
  uncertainty_notes?: string;
  requested_sources?: string[];
};

export type CreateReplaySessionRequest = {
  template_id: string;
  target: string;
  year: number;
  agent_id?: string;
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

export type NewsEvidenceRecord = {
  evidence_record_id: string;
  source: "gdelt";
  source_url: string;
  title: string;
  outlet: string;
  published_at: string;
  fetched_at: string;
  summary: string;
  language: string;
  country_iso3_list: string[];
  relationship_pair_list: string[];
  topics: string[];
  entities: string[];
  event_type: string | null;
  sentiment_tone: number | null;
  relevance_score: number;
  source_quality_score: number;
  confidence: ReplayForecastConfidence;
  raw_record_path: string;
};

export type ReplayEvidenceSnapshot = {
  evidence_snapshot_id: string;
  session_id: string;
  template_id: string;
  created_at: string;
  as_of_year: number;
  allowed_source_ids: string[];
  included_records: ReplayEvidenceIncludedRecord[];
  news_evidence_records?: NewsEvidenceRecord[];
  missing_sources: string[];
  excluded_future_records_count: number;
  fulfillment_records_included: number;
  fulfillment_records_excluded_irrelevant: number;
  post_lock_regeneration: boolean;
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

export type ReplayScorecard = {
  scorecard_id: string;
  session_id: string;
  template_id: string;
  created_at: string;
  forecast_probability: number;
  outcome: ReplayResolutionOutcome;
  brier_score: number | null;
  direction_correct: boolean | null;
  confidence: ReplayForecastConfidence | null;
  scoring_notes: string;
  limitations: string;
  source_paths: string[];
};

export type ReplayJudgeCheckStatus = "pass" | "warning" | "fail";

export type ReplayJudgeCheck = {
  name: string;
  status: ReplayJudgeCheckStatus;
  message: string;
};

export type ReplayJudgeAudit = {
  judge_audit_id: string;
  session_id: string;
  created_at: string;
  checks: ReplayJudgeCheck[];
  leakage_check: ReplayJudgeCheck;
  source_check: ReplayJudgeCheck;
  resolution_check: ReplayJudgeCheck;
  scoring_check: ReplayJudgeCheck;
  warnings: string[];
  errors: string[];
  overall_status: "pass" | "warning" | "fail";
};

export type ReplayPostmortem = {
  postmortem_id: string;
  session_id: string;
  created_at: string;
  question_text: string;
  forecast_summary: string;
  resolution_summary: string;
  score_summary: string;
  what_went_right: string[];
  what_went_wrong: string[];
  missed_signals: string[];
  source_limitations: string[];
  next_time_rules: string[];
};

export type ReplayComparisonGroup = {
  comparison_group_id: string;
  template_id: string;
  target: ForecastTarget;
  forecast_year: number;
  resolution_year: number;
  session_ids: string[];
  agent_ids: string[];
  created_at: string;
};

export type LeaderboardEntry = {
  agent_id: string;
  agent_name: string;
  agent_type: ForecastAgentType;
  total_forecasts: number;
  resolved_forecasts: number;
  average_brier_score: number | null;
  direction_accuracy: number | null;
  best_templates: string[];
  worst_templates: string[];
  common_source_gaps: string[];
  common_judge_warnings: string[];
  fulfilled_source_requests: number;
  improvement_trend: string | null;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  computed_at: string;
};

export type ForecastAgentRiskStyle = "cautious" | "balanced" | "aggressive";

export type ForecastAgentStrategy = {
  strategy_id: string;
  name: string;
  description: string;
  agent_id: string | null;
  version: number;
  risk_style: ForecastAgentRiskStyle;
  evidence_threshold: number;
  uncertainty_penalty: number;
  source_gap_sensitivity: number;
  preferred_source_ids: string[];
  rule_weights: Record<string, number>;
  active: boolean;
};

export type ForecastAgentRunStatus = "completed" | "needs_sources" | "failed";

export type ForecastAgentRecommendedAction = "lock" | "request_sources" | "human_review";

export type ForecastAgentRun = {
  agent_run_id: string;
  session_id: string;
  agent_id: string;
  strategy_id: string;
  created_at: string;
  status: ForecastAgentRunStatus;
  evidence_snapshot_id: string | null;
  source_request_ids_created: string[];
  source_request_ids_reused: string[];
  probability: number | null;
  confidence: ReplayForecastConfidence | null;
  rationale: string;
  key_signals: string[];
  assumptions: string[];
  uncertainty_notes: string;
  recommended_action: ForecastAgentRecommendedAction;
  warnings: string[];
  errors: string[];
};

export type CreateAgentStrategyRequest = {
  strategy_id?: string;
  name: string;
  description?: string;
  risk_style?: ForecastAgentRiskStyle;
  evidence_threshold?: number;
  uncertainty_penalty?: number;
  source_gap_sensitivity?: number;
  preferred_source_ids?: string[];
  rule_weights?: Record<string, number>;
  active?: boolean;
};

export type RunForecastAgentRequest = {
  strategy_id: string;
  agent_id?: string;
};

export type TournamentSourceRequestPolicy =
  | "ignore_missing_sources"
  | "create_requests_only"
  | "require_fulfillment_before_lock";

export type TournamentRunConfig = {
  require_evidence_snapshot: boolean;
  allow_auto_apply_agent_draft: boolean;
  allow_auto_lock: boolean;
  allow_auto_resolve_score_judge_postmortem: boolean;
  max_sessions: number;
  source_request_policy: TournamentSourceRequestPolicy;
};

export type TournamentStatus = "draft" | "running" | "completed" | "failed";

export type TournamentSessionError = {
  template_id: string;
  target: string;
  year: number;
  agent_id: string;
  strategy_id: string;
  session_id: string | null;
  error: string;
};

export type TournamentSummary = {
  total_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  needs_sources_sessions: number;
  locked_sessions: number;
  resolved_sessions: number;
  average_brier_by_agent: Record<string, number | null>;
  direction_accuracy_by_agent: Record<string, number | null>;
  average_brier_by_template: Record<string, number | null>;
  average_brier_by_strategy: Record<string, number | null>;
  common_source_gaps: string[];
  common_judge_warnings: string[];
  best_performing_strategy: string | null;
  worst_performing_strategy: string | null;
  recommended_strategy_changes: string[];
  strategy_tuning_suggestions: string[];
  session_errors: TournamentSessionError[];
};

export type ForecastTournament = {
  tournament_id: string;
  created_at: string;
  title: string;
  description: string;
  template_ids: string[];
  targets: string[];
  years: number[];
  agent_ids: string[];
  strategy_ids: string[];
  session_ids: string[];
  status: TournamentStatus;
  run_config: TournamentRunConfig;
  run_count: number;
  summary: TournamentSummary;
  warnings: string[];
  errors: string[];
};

export type CreateForecastTournamentRequest = {
  title: string;
  description?: string;
  template_ids: string[];
  targets: string[];
  years: number[];
  agent_ids: string[];
  strategy_ids: string[];
  run_config?: Partial<TournamentRunConfig>;
};

export type StrategyTuningProposalStatus = "proposed" | "accepted" | "rejected";

export type StrategyTuningProposedChanges = {
  evidence_threshold?: number;
  source_gap_sensitivity?: number;
  uncertainty_penalty?: number;
  preferred_source_ids?: string[];
  risk_style?: ForecastAgentRiskStyle;
};

export type ForecastStrategyTuningProposal = {
  proposal_id: string;
  tournament_id: string;
  agent_id: string;
  strategy_id: string;
  created_at: string;
  proposed_changes: StrategyTuningProposedChanges;
  reasons: string[];
  supporting_sessions: string[];
  source_gap_patterns: string[];
  judge_warning_patterns: string[];
  expected_effect: string;
  status: StrategyTuningProposalStatus;
  applied_at: string | null;
  previous_strategy_version: number | null;
  new_strategy_version: number | null;
};

export type TournamentExportSessionSummary = {
  session_id: string;
  template_id: string;
  target: string;
  agent_id: string | null;
  status: string;
  probability: number | null;
  brier_score: number | null;
  direction_correct: boolean | null;
  agent_run_status: string | null;
  strategy_id: string | null;
  source_request_count: number;
  artifact_paths: {
    session: string;
    evidence_snapshot: string | null;
    scorecard: string | null;
    judge_audit: string | null;
    postmortem: string | null;
  };
};

export type TournamentExportReport = {
  exported_at: string;
  tournament: ForecastTournament;
  sessions: TournamentExportSessionSummary[];
  agent_summaries: Record<
    string,
    { average_brier: number | null; direction_accuracy: number | null; session_count: number }
  >;
  template_summaries: Record<string, { average_brier: number | null; session_count: number }>;
  source_gaps: string[];
  judge_warnings: string[];
  score_summaries: Array<{ session_id: string; brier_score: number | null; outcome: string | null }>;
  strategy_tuning_suggestions: string[];
  tuning_proposal_ids: string[];
};

export type PolymarketCategoryConfig = {
  category_id: string;
  display_name: string;
  source_url: string;
  polymarket_slug: string;
  enabled: boolean;
  import_priority: number;
};

export type PolymarketSourceConfig = {
  version: string;
  source: "polymarket";
  gamma_api_base_url: string;
  categories: PolymarketCategoryConfig[];
};

export type QuestionResolutionStatus = "open" | "closed" | "resolved" | "unknown";

export type ForecastQuestionSourceMarket = {
  source_market_id: string;
  source: "polymarket";
  source_url: string;
  category: string;
  title: string;
  description: string;
  question_text: string;
  event_id: string;
  market_id: string;
  condition_id: string | null;
  outcomes: string[];
  outcome_prices: number[];
  implied_probability: number | null;
  volume: number | null;
  liquidity: number | null;
  start_date: string | null;
  end_date: string | null;
  resolution_status: QuestionResolutionStatus;
  resolution_source: string;
  tags: string[];
  related_country_iso3_list: string[];
  related_relationship_pair_list: string[];
  topics: string[];
  imported_at: string;
  raw_record_path: string;
  winning_outcome?: string | null;
  last_refreshed_at?: string | null;
};

export type PolymarketMarketRefresh = {
  refresh_id: string;
  source_market_id: string;
  market_id: string;
  session_id?: string | null;
  fetched_at: string;
  title: string;
  description: string;
  market_status: QuestionResolutionStatus;
  outcomes: string[];
  outcome_prices: number[];
  implied_probability: number | null;
  volume: number | null;
  liquidity: number | null;
  end_date: string | null;
  resolution_status: QuestionResolutionStatus;
  winning_outcome: string | null;
  source_url: string;
  refresh_mode: "mock" | "live";
};

export type PolymarketRefreshRequest = {
  use_mock?: boolean;
  source_market_ids?: string[];
  mock_state?: "open" | "resolved";
};

export type PolymarketRefreshResult = {
  refreshed_count: number;
  used_mock: boolean;
  refreshes: PolymarketMarketRefresh[];
};

export type ResolveFromMarketResult = {
  resolved: boolean;
  message: string;
  resolution?: ReplayResolution;
  refresh?: PolymarketMarketRefresh;
};

export type PolymarketQuestionQuery = {
  category?: string;
  status?: QuestionResolutionStatus;
  country?: string;
  relationship?: string;
  topic?: string;
  min_volume?: number;
  min_liquidity?: number;
  closing_before?: string;
  closing_after?: string;
  sort?: "volume" | "liquidity" | "end_date" | "imported_at";
  limit?: number;
};

export type CreateForecastSessionFromPolymarketRequest = {
  source_market_id: string;
  agent_id?: string;
};

export type PolymarketIngestRequest = {
  categories?: string[];
  use_mock?: boolean;
};

export type GdeltNewsSourceConfig = {
  version: string;
  source: "gdelt";
  doc_api_base_url: string;
  enabled: boolean;
  default_mode: "mock" | "live";
  mock_fixture_path: string;
  supported_query_types: string[];
  enabled_topics: string[];
  country_support: { enabled: boolean; iso3_field: string };
  relationship_support: { enabled: boolean; pair_field: string };
  default_date_window_days: number;
  max_records_per_ingest: number;
  live_fetch_requires_env: string;
  mock_mode_env: string;
};

export type GdeltNewsQuery = {
  query?: string;
  country?: string;
  relationship?: string;
  topic?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  sort?: "published_at" | "relevance_score" | "fetched_at";
};

export type GdeltNewsIngestRequest = {
  query?: string;
  country?: string;
  relationship?: string;
  topic?: string;
  start_date?: string;
  end_date?: string;
  use_mock?: boolean;
  limit?: number;
};

export type QuestionDomain =
  | "geopolitics"
  | "elections"
  | "economy_trade"
  | "crime"
  | "finance"
  | "politics"
  | "general";

export type EvidenceRecommendation = "forecast_now" | "request_more_sources" | "human_review";

export type SourceGap = {
  gap_id: string;
  question_domain: QuestionDomain;
  missing_source_id: string;
  reason: string;
  priority: ForecastSourceRequestPriority;
};

export type SessionEvidenceAssessmentScores = {
  relevance: number;
  recency: number;
  source_diversity: number;
  source_quality: number;
  metric_coverage: number;
  news_coverage: number;
  market_signal_strength: number;
  overall_evidence_score: number;
};

export type SessionEvidenceAssessment = {
  assessment_id: string;
  session_id: string;
  created_at: string;
  question_domain: QuestionDomain;
  scores: SessionEvidenceAssessmentScores;
  confidence_ceiling: ReplayForecastConfidence;
  recommendation: EvidenceRecommendation;
  source_mix: Record<string, number>;
  missing_sources: string[];
  source_gaps: SourceGap[];
  warnings: string[];
};

export type PlanSourceRequestsResult = {
  created: ForecastSourceRequest[];
  reused: ForecastSourceRequest[];
  skipped: SourceGap[];
};

export type DashboardSessionBucket =
  | "draft"
  | "locked"
  | "resolved"
  | "needs_sources"
  | "human_review";

export type DashboardQuestionRow = {
  source_market_id: string;
  title: string;
  category: string;
  implied_probability: number | null;
  volume: number | null;
  liquidity: number | null;
  end_date: string | null;
  resolution_status: QuestionResolutionStatus;
  source_url: string;
  last_refreshed_at: string | null;
};

export type DashboardSessionRow = {
  session_id: string;
  bucket: DashboardSessionBucket;
  status: ReplaySessionStatus;
  question_text: string;
  template_id: string;
  agent_id: string | null;
  agent_name: string | null;
  probability: number | null;
  confidence: ReplayForecastConfidence | null;
  evidence_score: number | null;
  recommendation: EvidenceRecommendation | null;
  market_status: QuestionResolutionStatus | null;
  source_gap_count: number;
  open_source_request_count: number;
  last_updated: string;
  forecast_mode: ForecastMode;
  external_source: "polymarket" | null;
  source_market_id: string | null;
  resolvable_from_market: boolean;
  latest_agent_run_id: string | null;
  latest_agent_run_status: ForecastAgentRun["status"] | null;
  latest_agent_run_recommended_action: ForecastAgentRun["recommended_action"] | null;
};

export type DashboardAgentRow = {
  agent_id: string;
  agent_name: string;
  agent_type: ForecastAgentType;
  resolved_forecasts: number;
  total_forecasts: number;
  average_brier_score: number | null;
  direction_accuracy: number | null;
  needs_sources_count: number;
  recent_runs: ForecastAgentRun[];
};

export type ForecastDashboardResponse = {
  computed_at: string;
  questions: DashboardQuestionRow[];
  sessions_by_bucket: Record<DashboardSessionBucket, DashboardSessionRow[]>;
  session_counts: Record<DashboardSessionBucket, number>;
  open_source_requests: ForecastSourceRequest[];
  agents: DashboardAgentRow[];
  recent_market_refreshes: PolymarketMarketRefresh[];
  warnings: string[];
  errors: string[];
};
