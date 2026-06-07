import type { AuthorityRank, RetrievalScoreInput } from "@/types/vector";

export function authorityScore(rank: AuthorityRank): number {
  switch (rank) {
    case "primary":
      return 1;
    case "international_dataset":
      return 0.9;
    case "institutional":
      return 0.75;
    case "news":
      return 0.6;
    case "wikipedia":
      return 0.35;
    case "manual":
      return 0.2;
  }
}

export function confidenceScore(confidence: string): number {
  switch (confidence) {
    case "high":
      return 1;
    case "medium":
      return 0.7;
    case "low":
      return 0.35;
    default:
      return 0.2;
  }
}

export function combineRetrievalScore(input: RetrievalScoreInput): number {
  return (
    input.semanticScore * 0.3 +
    input.keywordScore * 0.18 +
    input.moduleRelevanceScore * 0.16 +
    input.sourceAuthorityScore * 0.12 +
    input.freshnessScore * 0.08 +
    input.confidenceScore * 0.06 +
    (input.eventImportanceScore ?? 0) * 0.04 +
    input.selectedCountryBoost * 0.04 +
    (input.selectedRelationshipBoost ?? 0) * 0.02
  );
}
