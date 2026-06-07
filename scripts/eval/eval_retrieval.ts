import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { buildRetrievalContext } from "@/lib/rag/buildRetrievalContext";

type EvalItem = {
  eval_id: string;
  question: string;
  selectedCountries: string[];
  expected_modules: string[];
  expected_relationships: string[];
};

type EvalFile = {
  items: EvalItem[];
};

async function main() {
  const evalFile = await readJsonFile<EvalFile>(repoPath("data", "eval", "retrieval_eval.v1.json"));
  const failures: string[] = [];

  for (const item of evalFile.items) {
    if (item.expected_modules.length === 0) {
      failures.push(`${item.eval_id}: retrieval eval has no expected modules`);
      continue;
    }

    const context = await buildRetrievalContext({
      question: item.question,
      selectedCountries: item.selectedCountries,
      mode: "strategic",
    });
    const missingModules = item.expected_modules.filter(
      (moduleName) => !context.selectedModules.includes(moduleName),
    );
    const missingRelationships = item.expected_relationships.filter(
      (relationshipId) =>
        !context.retrievedRelationships.some((relationship) => relationship.relationship_id === relationshipId) &&
        !context.retrievalDebug.candidate_chunks.some((chunkId) => chunkId.includes(relationshipId)),
    );
    const wikipediaScores = context.retrievalDebug.scoring_breakdown.filter((entry) =>
      entry.chunk_id.toLowerCase().includes("wikipedia"),
    );
    const nonWikipediaScores = context.retrievalDebug.scoring_breakdown.filter(
      (entry) => !entry.chunk_id.toLowerCase().includes("wikipedia"),
    );
    const wikipediaOverPrioritized =
      wikipediaScores.length > 0 &&
      nonWikipediaScores.length > 0 &&
      Math.max(...wikipediaScores.map((entry) => entry.score)) >
        Math.max(...nonWikipediaScores.map((entry) => entry.score));

    if (missingModules.length > 0) {
      failures.push(`${item.eval_id}: missing expected modules ${missingModules.join(", ")}`);
    }
    if (missingRelationships.length > 0) {
      failures.push(`${item.eval_id}: missing expected relationships ${missingRelationships.join(", ")}`);
    }
    if (context.missingData.length === 0) {
      failures.push(`${item.eval_id}: missing data was not reported`);
    }
    if (context.citations.length === 0 && context.retrievedChunks.some((chunk) => chunk.source_ids.length > 0)) {
      failures.push(`${item.eval_id}: citations missing despite source-backed chunks`);
    }
    if (wikipediaOverPrioritized) {
      failures.push(`${item.eval_id}: Wikipedia was over-prioritized`);
    }
  }

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }

  console.log(`Retrieval eval passed for ${evalFile.items.length} item(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
