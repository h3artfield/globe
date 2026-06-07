import type { SourceConfig } from "@/types/pipeline";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

export async function loadSourceConfig(sourceId: string): Promise<SourceConfig> {
  return readJsonFile<SourceConfig>(
    repoPath("data", "sources", "source_configs", `${sourceId}.config.json`),
  );
}
