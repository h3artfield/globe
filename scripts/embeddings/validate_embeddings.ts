import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { pathExists, readJsonLinesFile, repoPath } from "@/lib/pipeline/io";
import type { RagChunk } from "@/types/pipeline";
import type { EmbeddedChunk } from "@/types/vector";
import { countryEmbeddingPath, relationshipEmbeddingPath } from "@/lib/vector/vectorStore";

async function validatePair(chunksPath: string, embeddingsPath: string, label: string) {
  const chunks = await readJsonLinesFile<RagChunk>(chunksPath);
  if (!(await pathExists(embeddingsPath))) {
    console.warn(`Warning: ${label}: chunks exist but embeddings are missing`);
    return;
  }

  const embeddings = await readJsonLinesFile<EmbeddedChunk>(embeddingsPath);
  const chunkIds = new Set(chunks.map((chunk) => chunk.chunk_id));
  const dimensions = new Set(embeddings.map((embedding) => embedding.embedding.length));

  if (dimensions.size > 1) {
    console.warn(`Warning: ${label}: embedding dimensions mismatch`);
  }

  for (const embedding of embeddings) {
    if (!embedding.chunk_id || !Array.isArray(embedding.embedding)) {
      throw new Error(`${label}: embedding file is malformed`);
    }
    if (!chunkIds.has(embedding.chunk_id)) {
      throw new Error(`${label}: chunk_id in embeddings does not exist in chunks.jsonl: ${embedding.chunk_id}`);
    }
  }
}

async function main() {
  for (const countryCode of MVP_COUNTRIES) {
    await validatePair(
      repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"),
      countryEmbeddingPath(countryCode),
      `country:${countryCode}`,
    );
  }

  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    await validatePair(
      repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl"),
      relationshipEmbeddingPath(relationshipId),
      `relationship:${relationshipId}`,
    );
  }

  console.log("Embedding validation complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
