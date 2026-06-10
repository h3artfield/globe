import type { ForecastQuestionSourceMarket, QuestionResolutionStatus } from "@/types/forecasting";
import type { GammaEventRecord, GammaMarketRecord } from "@/lib/forecasting/polymarket/gammaClient";
import { polymarketMarketUrl } from "@/lib/forecasting/polymarket/gammaClient";

const COMMON_ISO3 = [
  "USA",
  "CHN",
  "RUS",
  "UKR",
  "ISR",
  "IRN",
  "GBR",
  "FRA",
  "DEU",
  "TUR",
  "EGY",
  "IND",
  "PAK",
  "ETH",
];

function parseJsonArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseNumber(value: string | number | undefined | null): number | null {
  if (value == null || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function inferResolutionStatus(market: GammaMarketRecord): QuestionResolutionStatus {
  if (market.closed === true && market.active === false) {
    return "resolved";
  }
  if (market.closed === true) {
    return "closed";
  }
  if (market.active === true) {
    return "open";
  }
  return "unknown";
}

export function inferWinningOutcome(
  outcomes: string[],
  outcomePrices: number[],
  resolutionStatus: QuestionResolutionStatus,
): string | null {
  if (resolutionStatus !== "resolved" || outcomes.length === 0) {
    return null;
  }
  let winningIndex = 0;
  for (let index = 1; index < outcomePrices.length; index += 1) {
    if ((outcomePrices[index] ?? 0) > (outcomePrices[winningIndex] ?? 0)) {
      winningIndex = index;
    }
  }
  if ((outcomePrices[winningIndex] ?? 0) >= 0.9) {
    return outcomes[winningIndex] ?? null;
  }
  return null;
}

function extractCountries(text: string): string[] {
  const upper = text.toUpperCase();
  const found = new Set<string>();
  for (const iso3 of COMMON_ISO3) {
    if (upper.includes(iso3)) {
      found.add(iso3);
    }
  }
  const countryNames: Record<string, string> = {
    UKRAINE: "UKR",
    "UNITED STATES": "USA",
    "U.S.": "USA",
    CHINA: "CHN",
    RUSSIA: "RUS",
    ISRAEL: "ISR",
    IRAN: "IRN",
  };
  for (const [name, iso3] of Object.entries(countryNames)) {
    if (upper.includes(name)) {
      found.add(iso3);
    }
  }
  return [...found];
}

function extractRelationshipPairs(text: string, countries: string[]): string[] {
  const pairs = new Set<string>();
  if (text.toUpperCase().includes("CHN") && text.toUpperCase().includes("USA")) {
    pairs.add("CHN_USA");
  }
  if (countries.includes("CHN") && countries.includes("USA")) {
    pairs.add("CHN_USA");
  }
  return [...pairs];
}

export function normalizePolymarketMarket(
  event: GammaEventRecord,
  market: GammaMarketRecord,
  category: string,
  importedAt: string,
  rawRecordPath: string,
): ForecastQuestionSourceMarket {
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePricesRaw = parseJsonArray(market.outcomePrices).map((value) => Number(value));
  const outcomePrices = outcomePricesRaw.map((value) => (Number.isFinite(value) ? value : 0));
  const yesIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes");
  const impliedProbability =
    yesIndex >= 0 && outcomePrices[yesIndex] != null ? outcomePrices[yesIndex]! : outcomePrices[0] ?? null;

  const title = market.question ?? event.title ?? "Untitled Polymarket question";
  const description = market.description ?? event.description ?? "";
  const tagSlugs = (event.tags ?? []).map((tag) => tag.slug).filter(Boolean) as string[];
  const textBlob = `${title} ${description} ${event.title ?? ""}`;
  const countries = extractCountries(textBlob);
  const relationships = extractRelationshipPairs(textBlob, countries);
  const slug = market.slug ?? event.slug ?? market.id;

  const resolutionStatus = inferResolutionStatus(market);
  const winningOutcome = inferWinningOutcome(outcomes, outcomePrices, resolutionStatus);

  return {
    source_market_id: `polymarket_${market.id}`,
    source: "polymarket",
    source_url: polymarketMarketUrl(slug),
    category,
    title,
    description,
    question_text: title,
    event_id: String(event.id),
    market_id: String(market.id),
    condition_id: market.conditionId ?? null,
    outcomes,
    outcome_prices: outcomePrices,
    implied_probability: impliedProbability,
    volume: parseNumber(market.volumeNum ?? market.volume),
    liquidity: parseNumber(market.liquidityNum ?? market.liquidity),
    start_date: market.startDate ?? null,
    end_date: market.endDate ?? null,
    resolution_status: resolutionStatus,
    resolution_source: market.resolutionSource ?? market.resolvedBy ?? "",
    tags: tagSlugs,
    related_country_iso3_list: countries,
    related_relationship_pair_list: relationships,
    topics: tagSlugs,
    imported_at: importedAt,
    raw_record_path: rawRecordPath,
    winning_outcome: winningOutcome,
    last_refreshed_at: importedAt,
  };
}

export function flattenPolymarketEvents(
  events: GammaEventRecord[],
  category: string,
  importedAt: string,
  rawRecordPath: string,
): ForecastQuestionSourceMarket[] {
  const questions: ForecastQuestionSourceMarket[] = [];
  for (const event of events) {
    for (const market of event.markets ?? []) {
      questions.push(normalizePolymarketMarket(event, market, category, importedAt, rawRecordPath));
    }
  }
  return questions;
}
