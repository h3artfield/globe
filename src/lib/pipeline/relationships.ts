import type { RelationshipModule } from "@/types/pipeline";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { RELATIONSHIP_MODULES } from "./constants";

export function createRelationshipModule(
  countries: readonly [string, string],
  module: string,
  generatedAt: string,
): RelationshipModule {
  const relationshipId = buildRelationshipId(countries[0], countries[1]);
  const sortedCountries = relationshipId.split("_") as [string, string];

  return {
    relationship_id: relationshipId,
    countries: sortedCountries,
    module,
    version: "1.0",
    last_updated: generatedAt.slice(0, 10),
    summary: "",
    key_findings: [],
    metrics: [],
    claims: [],
    open_questions: ["Populate this relationship module with sourced bilateral data and claims."],
    source_ids: [],
    confidence: {
      overall: "unknown",
      weak_areas: ["metrics", "claims", "sources"],
    },
  };
}

export function createAllRelationshipModules(
  countries: readonly [string, string],
  generatedAt: string,
): RelationshipModule[] {
  return RELATIONSHIP_MODULES.map((module) =>
    createRelationshipModule(countries, module, generatedAt),
  );
}
