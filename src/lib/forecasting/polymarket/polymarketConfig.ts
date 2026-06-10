import type { PolymarketSourceConfig } from "@/types/forecasting";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

const CONFIG_PATH = repoPath(
  "data",
  "forecasting",
  "source_configs",
  "polymarket_categories.v1.json",
);

export async function loadPolymarketSourceConfig(): Promise<PolymarketSourceConfig> {
  return readJsonFile<PolymarketSourceConfig>(CONFIG_PATH);
}

export function isPolymarketLiveFetchAllowed(): boolean {
  return process.env.POLYMARKET_ALLOW_LIVE_FETCH === "true";
}

export function isPolymarketMockMode(): boolean {
  return (
    process.env.POLYMARKET_USE_MOCK === "true" ||
    process.env.NODE_ENV === "test" ||
    !isPolymarketLiveFetchAllowed()
  );
}

export const POLYMARKET_TEMPLATE_ID = "polymarket_live_question";
