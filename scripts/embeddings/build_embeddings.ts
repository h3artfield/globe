import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { readJsonLinesFile, repoPath } from "@/lib/pipeline/io";
import type { RagChunk } from "@/types/pipeline";
import { embedChunks } from "@/lib/vector/chunkEmbedder";
import { getEmbeddingProvider } from "@/lib/vector/embeddingProvider";
import { countryEmbeddingPath, relationshipEmbeddingPath, writeEmbeddedChunks } from "@/lib/vector/vectorStore";

async function buildCountry(countryCode: string) {
  const chunks = await readJsonLinesFile<RagChunk>(
    repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"),
  );
  const embedded = await embedChunks(chunks, getEmbeddingProvider());
  await writeEmbeddedChunks(countryEmbeddingPath(countryCode), embedded);
}

async function buildRelationship(relationshipId: string) {
  const chunks = await readJsonLinesFile<RagChunk>(
    repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl"),
  );
  const embedded = await embedChunks(chunks, getEmbeddingProvider());
  await writeEmbeddedChunks(relationshipEmbeddingPath(relationshipId), embedded);
}

async function main() {
  const target = process.argv[2];

  if (target === "--mvp") {
    for (const countryCode of MVP_COUNTRIES) await buildCountry(countryCode);
    for (const pair of MVP_RELATIONSHIP_PAIRS) await buildRelationship(buildRelationshipId(pair[0], pair[1]));
    return;
  }

  if (!target) {
    throw new Error("Usage: npm run embeddings:build -- USA");
  }

  if (target.includes("_")) {
    await buildRelationship(target);
  } else {
    await buildCountry(target.toUpperCase());
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
