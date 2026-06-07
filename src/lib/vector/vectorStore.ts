import type { EmbeddedChunk } from "@/types/vector";
import { pathExists, readJsonLinesFile, repoPath, writeJsonLinesFile } from "@/lib/pipeline/io";

export function countryEmbeddingPath(countryCode: string): string {
  return repoPath("data", "vector", "countries", countryCode, "chunks.embeddings.jsonl");
}

export function relationshipEmbeddingPath(relationshipId: string): string {
  return repoPath("data", "vector", "relationships", relationshipId, "chunks.embeddings.jsonl");
}

export async function writeEmbeddedChunks(pathname: string, chunks: EmbeddedChunk[]): Promise<void> {
  await writeJsonLinesFile(pathname, chunks);
}

export async function readEmbeddedChunks(pathname: string): Promise<EmbeddedChunk[]> {
  return (await pathExists(pathname)) ? readJsonLinesFile<EmbeddedChunk>(pathname) : [];
}
