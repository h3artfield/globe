import type { AskMode } from "@/types/api";
import type { MissingDataWarning, RetrievalContext } from "@/types/vector";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { buildCountryPairs } from "@/lib/globe/countryIdMap";
import { loadPipelineAskContext } from "./loadPipelineRag";
import { selectRelevantModules } from "./selectRelevantModules";
import { getEmbeddingProvider } from "@/lib/vector/embeddingProvider";
import { hybridSearch } from "@/lib/vector/hybridSearch";
import { countryEmbeddingPath, readEmbeddedChunks, relationshipEmbeddingPath } from "@/lib/vector/vectorStore";
import { citationsFromChunks, citationsFromMetrics, dedupeCitations } from "@/lib/vector/citationBuilder";

export async function buildRetrievalContext(input: {
  question: string;
  selectedCountries: string[];
  mode: AskMode | "overview" | "compare" | "timeline" | "source_audit";
}): Promise<RetrievalContext> {
  const relevant = selectRelevantModules(input.question);
  const pipelineContext = await loadPipelineAskContext(input.selectedCountries, relevant);
  const relationshipIds = buildCountryPairs(pipelineContext.selectedCountries).map(([a, b]) =>
    buildRelationshipId(a, b),
  );
  const embeddedChunks = (
    await Promise.all([
      ...pipelineContext.selectedCountries.map((countryCode) =>
        readEmbeddedChunks(countryEmbeddingPath(countryCode)),
      ),
      ...relationshipIds.map((relationshipId) =>
        readEmbeddedChunks(relationshipEmbeddingPath(relationshipId)),
      ),
    ])
  ).flat();
  const allChunks = [...pipelineContext.countryChunks, ...pipelineContext.relationshipChunks];
  const selectedModules = Array.from(new Set([...relevant.countryModules, ...relevant.relationshipModules]));
  const scoredChunks = await hybridSearch({
    question: input.question,
    chunks: allChunks,
    embeddedChunks,
    selectedModules,
    selectedCountries: pipelineContext.selectedCountries,
    selectedRelationships: relationshipIds,
    provider: getEmbeddingProvider(),
    limit: 10,
  });
  const retrievedChunks = scoredChunks.map((result) => result.chunk);
  const chunkMetricIds = new Set(retrievedChunks.flatMap((chunk) => chunk.metric_ids ?? []));
  const retrievedMetrics = pipelineContext.metrics.filter((metric) =>
    chunkMetricIds.size > 0 ? chunkMetricIds.has(metric.metric_id) : true,
  ).slice(0, 20);
  const citations = dedupeCitations([
    ...citationsFromChunks(retrievedChunks),
    ...citationsFromMetrics(retrievedMetrics),
  ]).filter((citation) => citation.source_id !== "missing_source");
  const missingData: MissingDataWarning[] = pipelineContext.missingData.map((message) => ({
    scope: "pipeline",
    message,
    severity: "warning",
  }));

  return {
    questionType: relevant.topics[0] ?? "general",
    selectedModules,
    retrievedChunks,
    retrievedMetrics,
    retrievedEvents: [],
    retrievedRelationships: pipelineContext.relationshipModules,
    citations,
    missingData,
    retrievalDebug: {
      question_type: relevant.topics[0] ?? "general",
      selected_modules: selectedModules,
      candidate_chunks: allChunks.map((chunk) => chunk.chunk_id),
      final_chunks: retrievedChunks.map((chunk) => chunk.chunk_id),
      scoring_breakdown: scoredChunks.map((result) => ({
        chunk_id: result.chunk.chunk_id,
        score: result.score,
        scoring: result.scoring,
      })),
      dropped_candidates: allChunks
        .map((chunk) => chunk.chunk_id)
        .filter((chunkId) => !retrievedChunks.some((chunk) => chunk.chunk_id === chunkId)),
    },
  };
}
