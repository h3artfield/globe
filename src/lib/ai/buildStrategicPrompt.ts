import type { RagContext } from "@/types/rag";

export function buildStrategicPrompt(question: string, ragContext: RagContext): string {
  const loadedCountries = ragContext.countryProfiles
    .filter((profile) => profile.exists)
    .map((profile) => ({
      country_code: profile.data.country_code,
      country_name: profile.data.country_name,
      sections: profile.data.sections,
      confidence: profile.data.confidence,
    }));

  const loadedRelationships = ragContext.relationshipProfiles
    .filter((profile) => profile.exists)
    .map((profile) => ({
      relationship_id: profile.data.relationship_id,
      countries: profile.data.countries,
      sections: profile.data.sections,
      confidence: profile.data.confidence,
    }));

  return [
    "You are a strategic analysis assistant.",
    "Use only the provided local RAG context. Separate facts from inference.",
    "Explain incentives, constraints, likely moves, second-order effects, confidence, and missing data.",
    "If data is incomplete, say so clearly and avoid false certainty.",
    "",
    `Question: ${question}`,
    "",
    `Selected countries: ${ragContext.selectedCountries.join(", ")}`,
    "",
    "Country profiles:",
    JSON.stringify(loadedCountries, null, 2),
    "",
    "Relationship profiles:",
    JSON.stringify(loadedRelationships, null, 2),
    "",
    "Missing data:",
    JSON.stringify(ragContext.missingData, null, 2),
  ].join("\n");
}
