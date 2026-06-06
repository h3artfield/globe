import type { RagContext } from "@/types/rag";

export type ScenarioOutline = {
  scenario: string;
  countries: string[];
  loadedCountryProfiles: string[];
  loadedRelationshipProfiles: string[];
  missingData: string[];
};

export function buildScenarioOutline(question: string, ragContext: RagContext): ScenarioOutline {
  return {
    scenario: question,
    countries: ragContext.selectedCountries,
    loadedCountryProfiles: ragContext.countryProfiles
      .filter((profile) => profile.exists)
      .map((profile) => profile.countryCode),
    loadedRelationshipProfiles: ragContext.relationshipProfiles
      .filter((profile) => profile.exists)
      .map((profile) => profile.relationshipId),
    missingData: ragContext.missingData,
  };
}
