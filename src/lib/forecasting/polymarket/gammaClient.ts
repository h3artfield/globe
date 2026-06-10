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
const MOCK_STATES_FIXTURE = repoPath("test", "fixtures", "polymarket", "gamma_market_states.v1.json");

export type PolymarketMockMarketState = "default" | "open" | "resolved";

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

function findMarketInEvents(
  events: GammaEventRecord[],
  marketId: string,
): { event: GammaEventRecord; market: GammaMarketRecord } | null {
  for (const event of events) {
    for (const market of event.markets ?? []) {
      if (String(market.id) === marketId) {
        return { event, market };
      }
    }
  }
  return null;
}

async function loadMockMarketEvents(state: PolymarketMockMarketState): Promise<GammaEventRecord[]> {
  if (state === "default") {
    const raw = await readFile(MOCK_FIXTURE, "utf8");
    return JSON.parse(raw) as GammaEventRecord[];
  }
  const raw = await readFile(MOCK_STATES_FIXTURE, "utf8");
  const payload = JSON.parse(raw) as { open: GammaEventRecord[]; resolved: GammaEventRecord[] };
  return state === "resolved" ? payload.resolved : payload.open;
}

async function fetchGammaMarketById(baseUrl: string, marketId: string): Promise<GammaMarketRecord | null> {
  const url = `${baseUrl.replace(/\/$/, "")}/markets/${marketId}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Gamma API market fetch failed for ${marketId}: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as GammaMarketRecord;
  return payload?.id ? payload : null;
}

export async function fetchPolymarketMarketRecord(
  marketId: string,
  options?: { forceMock?: boolean; mockState?: PolymarketMockMarketState },
): Promise<{ event: GammaEventRecord; market: GammaMarketRecord } | null> {
  if (options?.forceMock || isPolymarketMockMode()) {
    const mockState = options?.mockState ?? "open";
    const events = await loadMockMarketEvents(mockState === "default" ? "default" : mockState);
    return findMarketInEvents(events, marketId);
  }

  const config = await loadPolymarketSourceConfig();
  const market = await fetchGammaMarketById(config.gamma_api_base_url, marketId);
  if (!market) {
    return null;
  }
  return {
    event: {
      id: market.id,
      title: market.question,
      slug: market.slug,
      description: market.description,
      markets: [market],
    },
    market,
  };
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
