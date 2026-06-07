import type { RagChunk } from "@/types/pipeline";
import type { AuthorityRank, EmbeddedChunk } from "@/types/vector";
import type { EmbeddingProvider } from "./embeddingProvider";

export function inferAuthorityRank(chunk: RagChunk): AuthorityRank {
  if (chunk.authority_rank) {
    return chunk.authority_rank as AuthorityRank;
  }
  if (chunk.source_family === "wikipedia" || chunk.source_ids.includes("wikipedia")) {
    return "wikipedia";
  }
  if (chunk.source_ids.some((sourceId) => sourceId.includes("world_bank") || sourceId.includes("un_") || sourceId === "vdem" || sourceId === "wipo")) {
    return "international_dataset";
  }
  if (chunk.source_ids.some((sourceId) => sourceId.includes("manual"))) {
    return "manual";
  }
  return chunk.source_ids.length > 0 ? "institutional" : "manual";
}

export async function embedChunks(
  chunks: RagChunk[],
  provider: EmbeddingProvider,
): Promise<EmbeddedChunk[]> {
  const embeddings = await provider.embedTexts(
    chunks.map((chunk) => `${chunk.module} ${(chunk.tags ?? []).join(" ")} ${chunk.text}`),
  );

  return chunks.map((chunk, index) => ({
    chunk_id: chunk.chunk_id,
    embedding: embeddings[index],
    text: chunk.text,
    country_code: chunk.country_code,
    relationship_id: chunk.relationship_id,
    module: chunk.module,
    source_ids: chunk.source_ids,
    claim_type: chunk.claim_type,
    confidence: chunk.confidence,
    authority_rank: inferAuthorityRank(chunk),
    can_override_official_data:
      chunk.can_override_official_data ?? inferAuthorityRank(chunk) === "international_dataset",
    year_range: chunk.year_range,
  }));
}
