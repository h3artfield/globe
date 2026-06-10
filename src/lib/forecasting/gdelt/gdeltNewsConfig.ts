import type { GdeltNewsSourceConfig } from "@/types/forecasting";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

const CONFIG_PATH = repoPath(
  "data",
  "forecasting",
  "source_configs",
  "gdelt_news.v1.json",
);

export async function loadGdeltNewsSourceConfig(): Promise<GdeltNewsSourceConfig> {
  return readJsonFile<GdeltNewsSourceConfig>(CONFIG_PATH);
}

export function isGdeltLiveFetchAllowed(): boolean {
  return process.env.GDELT_ALLOW_LIVE_FETCH === "true";
}

export function isGdeltMockMode(): boolean {
  return (
    process.env.GDELT_USE_MOCK === "true" ||
    process.env.NODE_ENV === "test" ||
    !isGdeltLiveFetchAllowed()
  );
}

export const GDELT_NEWS_SOURCE_ID = "gdelt_news_events";
