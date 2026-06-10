import path from "node:path";
import { readFile } from "node:fs/promises";
import { isPolymarketMockMode, loadPolymarketSourceConfig } from "@/lib/forecasting/polymarket/polymarketConfig";
import { repoPath } from "@/lib/pipeline/io";

export type GammaEventRecord = {
  id: string;
  title?: string;
  slug?: string;
  description?: string;
  tags?: Array<{ slug?: string; label?: string }>;
  markets?: GammaMarketRecord[];
};

export type GammaMarketRecord = {
  id: string;
  question?: string;
  slug?: string;
  conditionId?: string;
  description?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string;
  volumeNum?: number;
  liquidity?: string;
  liquidityNum?: number;
  startDate?: string;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  resolvedBy?: string;
  resolutionSource?: string;
  enableOrderBook?: boolean;
};

const MOCK_FIXTURE = repoPath("test", "fixtures", "polymarket", "gamma_events_politics.v1.json");

async function fetchGammaEventsByTag(
  baseUrl: string,
  tagSlug: string,
  limit = 50,
): Promise<GammaEventRecord[]> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/events`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Gamma API events failed for tag ${tagSlug}: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as GammaEventRecord[];
  return Array.isArray(payload) ? payload : [];
}

async function loadMockEvents(categorySlug: string): Promise<GammaEventRecord[]> {
  const raw = await readFile(MOCK_FIXTURE, "utf8");
  const events = JSON.parse(raw) as GammaEventRecord[];
  return events.filter((event) =>
    (event.tags ?? []).some((tag) => tag.slug === categorySlug),
  );
}

export async function fetchPolymarketCategoryEvents(
  categorySlug: string,
  options?: { limit?: number; forceMock?: boolean },
): Promise<GammaEventRecord[]> {
  if (options?.forceMock || isPolymarketMockMode()) {
    return loadMockEvents(categorySlug);
  }

  const config = await loadPolymarketSourceConfig();
  return fetchGammaEventsByTag(config.gamma_api_base_url, categorySlug, options?.limit ?? 50);
}

export function polymarketMarketUrl(slug: string): string {
  return `https://polymarket.com/event/${slug}`;
}

export function fixturePathForCategory(categorySlug: string, dateStamp: string): string {
  return path.join("data", "raw", "polymarket", dateStamp, `${categorySlug}_events.v1.json`);
}
