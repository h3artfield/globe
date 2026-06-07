import type { SourceRegistryEntry } from "@/types/pipeline";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

type SourceRegistryFile = {
  version: string;
  sources: SourceRegistryEntry[];
};

export async function loadSourceRegistry(): Promise<SourceRegistryEntry[]> {
  const registry = await readJsonFile<SourceRegistryFile>(
    repoPath("data", "sources", "source_registry.v1.json"),
  );
  return registry.sources;
}

export async function getSourceRegistryEntry(sourceId: string): Promise<SourceRegistryEntry | null> {
  const sources = await loadSourceRegistry();
  return sources.find((source) => source.source_id === sourceId) ?? null;
}
