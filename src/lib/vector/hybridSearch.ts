import type { RagChunk } from "@/types/pipeline";
import type { EmbeddedChunk, ScoredChunk } from "@/types/vector";
import type { EmbeddingProvider } from "./embeddingProvider";
import { authorityScore, combineRetrievalScore, confidenceScore } from "./retrievalScorer";
import { cosineSimilarity } from "./vectorSearch";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
}

function keywordScore(question: string, text: string): number {
  const questionTokens = tokenize(question);
  const textTokens = tokenize(text);
  if (questionTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of questionTokens) {
    if (textTokens.has(token)) overlap += 1;
  }
  return Math.min(1, overlap / Math.max(1, questionTokens.size));
}

function freshnessScore(chunk: RagChunk): number {
  if (!chunk.year_range) return 0.4;
  const latestYear = chunk.year_range[1];
  const age = new Date().getUTCFullYear() - latestYear;
  return age <= 1 ? 1 : age <= 3 ? 0.75 : age <= 7 ? 0.45 : 0.25;
}

export async function hybridSearch(input: {
  question: string;
  chunks: RagChunk[];
  embeddedChunks: EmbeddedChunk[];
  selectedModules: string[];
  selectedCountries: string[];
  selectedRelationships: string[];
  provider: EmbeddingProvider;
  limit?: number;
}): Promise<ScoredChunk[]> {
  const questionEmbedding = await input.provider.embedText(input.question);
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.chunk_id, chunk]));
  const selectedModuleSet = new Set(input.selectedModules);
  const selectedCountrySet = new Set(input.selectedCountries);
  const selectedRelationshipSet = new Set(input.selectedRelationships);

  return input.embeddedChunks
    .map((embedded): ScoredChunk | null => {
      const chunk = chunkById.get(embedded.chunk_id);
      if (!chunk) return null;

      const semanticScore = Math.max(0, cosineSimilarity(questionEmbedding, embedded.embedding));
      const scoring = {
        semanticScore,
        keywordScore: keywordScore(input.question, `${embedded.module} ${embedded.text}`),
        moduleRelevanceScore: selectedModuleSet.has(embedded.module) ? 1 : 0.2,
        sourceAuthorityScore: authorityScore(embedded.authority_rank),
        freshnessScore: freshnessScore(chunk),
        confidenceScore: confidenceScore(embedded.confidence),
        eventImportanceScore: 0,
        selectedCountryBoost:
          embedded.country_code && selectedCountrySet.has(embedded.country_code) ? 1 : 0,
        selectedRelationshipBoost:
          embedded.relationship_id && selectedRelationshipSet.has(embedded.relationship_id) ? 1 : 0,
      };

      return {
        chunk,
        score: combineRetrievalScore(scoring),
        scoring,
      };
    })
    .filter((result): result is ScoredChunk => result !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 12);
}
