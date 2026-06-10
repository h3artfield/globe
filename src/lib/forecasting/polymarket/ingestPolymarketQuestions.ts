import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { ForecastQuestionSourceMarket, PolymarketIngestRequest } from "@/types/forecasting";
import {
  fetchPolymarketCategoryEvents,
  fixturePathForCategory,
  type GammaEventRecord,
} from "@/lib/forecasting/polymarket/gammaClient";
import { flattenPolymarketEvents } from "@/lib/forecasting/polymarket/normalizePolymarketMarket";
import {
  isPolymarketMockMode,
  loadPolymarketSourceConfig,
} from "@/lib/forecasting/polymarket/polymarketConfig";
import {
  appendQuestionsJsonl,
  replaceQuestionsJsonl,
  upsertQuestionIndex,
} from "@/lib/forecasting/polymarket/questionStore";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

export type PolymarketIngestResult = {
  imported_count: number;
  categories: string[];
  used_mock: boolean;
  raw_paths: string[];
};

async function saveRawCategoryPayload(
  categorySlug: string,
  events: GammaEventRecord[],
  dateStamp: string,
): Promise<string> {
  const relativePath = fixturePathForCategory(categorySlug, dateStamp);
  const absolutePath = repoPath(...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeJsonFile(absolutePath, {
    fetched_at: new Date().toISOString(),
    category: categorySlug,
    events,
  });
  return relativePath.replace(/\\/g, "/");
}

export async function ingestPolymarketQuestions(
  request: PolymarketIngestRequest = {},
): Promise<PolymarketIngestResult> {
  const config = await loadPolymarketSourceConfig();
  const useMock = request.use_mock ?? isPolymarketMockMode();
  const enabledCategories = config.categories
    .filter((category) => category.enabled)
    .filter((category) =>
      request.categories?.length ? request.categories.includes(category.category_id) : true,
    )
    .sort((left, right) => left.import_priority - right.import_priority);

  const importedAt = new Date().toISOString();
  const dateStamp = importedAt.slice(0, 10);
  const allQuestions: ForecastQuestionSourceMarket[] = [];
  const rawPaths: string[] = [];

  for (const category of enabledCategories) {
    const events = await fetchPolymarketCategoryEvents(category.polymarket_slug, {
      forceMock: useMock,
      limit: useMock ? 20 : 50,
    });
    const rawPath = await saveRawCategoryPayload(category.polymarket_slug, events, dateStamp);
    rawPaths.push(rawPath);
    allQuestions.push(
      ...flattenPolymarketEvents(events, category.category_id, importedAt, rawPath),
    );
  }

  if (useMock) {
    await replaceQuestionsJsonl(allQuestions);
  } else {
    await appendQuestionsJsonl(allQuestions);
  }
  upsertQuestionIndex(allQuestions);

  return {
    imported_count: allQuestions.length,
    categories: enabledCategories.map((category) => category.category_id),
    used_mock: useMock,
    raw_paths: rawPaths,
  };
}
