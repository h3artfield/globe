import type { CountryModule, RelationshipModule } from "@/types/pipeline";
import type { RelationshipGraph } from "@/types/worldModel";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";

export const WORLD_MODEL_COUNTRY_MODULES = [
  "allies_and_partners",
  "adversaries_and_rivals",
  "national_event_timeline",
  "top_national_events_20_years",
  "news_memory",
  "threat_perception",
] as const;

export const WORLD_MODEL_RELATIONSHIP_MODULES = [
  "relationship_event_timeline",
  "alliance_status",
  "adversary_status",
  "crisis_history",
  "war_history",
  "diplomatic_history",
] as const;

export function emptyCountryWorldModule(countryCode: string, moduleName: string): CountryModule {
  return {
    country_code: countryCode,
    module: moduleName,
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    summary: "",
    key_findings: [],
    metrics: [],
    claims: [],
    open_questions: ["World-model data is pending verified event/alliance/adversary sources."],
    source_ids: [],
    generation_status: "auto_generated_structured_data",
    confidence: {
      overall: "unknown",
      weak_areas: ["sources", "events", "claims"],
    },
  };
}

export function emptyRelationshipWorldModule(
  relationshipId: string,
  moduleName: string,
): RelationshipModule {
  return {
    relationship_id: relationshipId,
    countries: relationshipId.split("_") as [string, string],
    module: moduleName,
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    summary: "",
    key_findings: [],
    metrics: [],
    claims: [],
    open_questions: ["Relationship world-model data is pending verified event/alliance/adversary sources."],
    source_ids: [],
    generation_status: "auto_generated_structured_data",
    confidence: {
      overall: "unknown",
      weak_areas: ["sources", "events", "claims"],
    },
  };
}

export function buildEmptyRelationshipGraph(): RelationshipGraph {
  return {
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    nodes: MVP_COUNTRIES.map((countryCode) => ({
      country_code: countryCode,
      name: countryCode,
      region: "",
      power_tier: countryCode === "USA" || countryCode === "CHN" ? "global" : "regional",
      source_ids: [],
    })),
    edges: MVP_RELATIONSHIP_PAIRS.map((pair) => {
      const relationshipId = buildRelationshipId(pair[0], pair[1]);
      const [from, to] = relationshipId.split("_");
      return {
        from,
        to,
        relationship_id: relationshipId,
        overall_alignment_score: null,
        alliance_score: null,
        hostility_score: null,
        trade_dependency_score: null,
        military_tension_score: null,
        sanctions_score: null,
        diplomatic_support_score: null,
        public_opinion_score: null,
        historical_grievance_score: null,
        trend: "unknown",
        source_ids: [],
        confidence: "unknown",
      };
    }),
  };
}
