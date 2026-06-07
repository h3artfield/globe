import type { ClaimType } from "./pipeline";
import type { ConfidenceLevel } from "./rag";

export type LongTermImportance = "low" | "medium" | "high" | "historic";
export type RelationshipTrend = "improving" | "stable" | "worsening" | "unknown";

export type WorldEvent = {
  event_id: string;
  event_date: string;
  year: number;
  country_codes: string[];
  relationship_id: string | null;
  event_type: string;
  event_category: string;
  headline: string;
  summary: string;
  actors: string[];
  locations: string[];
  importance_score: number | null;
  domestic_impact_score: number | null;
  international_impact_score: number | null;
  economic_impact_score: number | null;
  security_impact_score: number | null;
  regime_impact_score: number | null;
  long_term_importance: LongTermImportance;
  source_ids: string[];
  claim_type: ClaimType;
  confidence: ConfidenceLevel;
  notes: string;
};

export type RelationshipEvent = {
  event_id: string;
  relationship_id: string;
  event_date: string;
  year: number;
  countries: [string, string];
  event_type: string;
  headline: string;
  summary: string;
  actors: string[];
  importance_score: number | null;
  escalation_score: number | null;
  deescalation_score: number | null;
  economic_impact_score: number | null;
  military_impact_score: number | null;
  diplomatic_impact_score: number | null;
  source_ids: string[];
  confidence: ConfidenceLevel;
  notes: string;
};

export type YearlyEventSummary = {
  year: number;
  summary: string;
  top_events: string[];
  dominant_themes: string[];
  regime_impact: string;
  economic_impact: string;
  social_impact: string;
  foreign_policy_impact: string;
};

export type RelationshipGraphNode = {
  country_code: string;
  name: string;
  region: string;
  power_tier: "global" | "major" | "regional" | "minor" | "micro";
  source_ids: string[];
};

export type RelationshipGraphEdge = {
  from: string;
  to: string;
  relationship_id: string;
  overall_alignment_score: number | null;
  alliance_score: number | null;
  hostility_score: number | null;
  trade_dependency_score: number | null;
  military_tension_score: number | null;
  sanctions_score: number | null;
  diplomatic_support_score: number | null;
  public_opinion_score: number | null;
  historical_grievance_score: number | null;
  trend: RelationshipTrend;
  source_ids: string[];
  confidence: ConfidenceLevel;
};

export type RelationshipGraph = {
  version: "1.0";
  last_updated: string;
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
};
