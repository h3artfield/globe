import type { GdeltRawArticleRecord } from "@/lib/forecasting/gdelt/gdeltNewsClient";
import type { NewsEvidenceRecord, ReplayForecastConfidence } from "@/types/forecasting";

function parseGdeltSeenDate(seenDate: string | undefined): string {
  if (!seenDate || seenDate.length < 8) {
    return new Date().toISOString();
  }
  const year = seenDate.slice(0, 4);
  const month = seenDate.slice(4, 6);
  const day = seenDate.slice(6, 8);
  const hour = seenDate.length >= 10 ? seenDate.slice(8, 10) : "00";
  const minute = seenDate.length >= 12 ? seenDate.slice(10, 12) : "00";
  const second = seenDate.length >= 14 ? seenDate.slice(12, 14) : "00";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

function inferCountries(article: GdeltRawArticleRecord): string[] {
  const countries = new Set<string>();
  if (article.sourcecountry) {
    countries.add(article.sourcecountry.toUpperCase());
  }
  for (const entity of article.entities ?? []) {
    if (/^[A-Z]{3}$/.test(entity)) {
      countries.add(entity.toUpperCase());
    }
  }
  return [...countries];
}

function inferRelationships(countries: string[]): string[] {
  const pairs = new Set<string>();
  if (countries.includes("CHN") && countries.includes("USA")) {
    pairs.add("CHN_USA");
  }
  if (countries.includes("RUS") && countries.includes("UKR")) {
    pairs.add("RUS_UKR");
  }
  return [...pairs];
}

function inferTopics(article: GdeltRawArticleRecord): string[] {
  return (article.themes ?? []).map((theme) => theme.toLowerCase());
}

function scoreRelevance(article: GdeltRawArticleRecord, queryTerms: string[]): number {
  const haystack = `${article.title ?? ""} ${article.summary ?? ""}`.toLowerCase();
  if (queryTerms.length === 0) {
    return 0.55;
  }
  const hits = queryTerms.filter((term) => haystack.includes(term.toLowerCase())).length;
  return Math.min(0.95, 0.35 + hits * 0.15);
}

function scoreOutletQuality(domain: string): number {
  const trusted = ["reuters.com", "apnews.com", "bbc.co.uk", "nytimes.com", "ft.com"];
  if (trusted.some((item) => domain.includes(item))) {
    return 0.85;
  }
  return domain ? 0.65 : 0.5;
}

function inferConfidence(relevance: number, quality: number): ReplayForecastConfidence {
  const combined = (relevance + quality) / 2;
  if (combined >= 0.75) {
    return "high";
  }
  if (combined >= 0.55) {
    return "medium";
  }
  return "low";
}

export function normalizeGdeltArticle(
  article: GdeltRawArticleRecord,
  fetchedAt: string,
  rawRecordPath: string,
  queryTerms: string[] = [],
): NewsEvidenceRecord {
  const countries = inferCountries(article);
  const relationships = inferRelationships(countries);
  const topics = inferTopics(article);
  const outlet = article.domain ?? "unknown";
  const relevance = scoreRelevance(article, queryTerms);
  const quality = scoreOutletQuality(outlet);
  const id = article.id ?? article.url ?? `gdelt_${Date.now()}`;

  return {
    evidence_record_id: `gdelt_${id}`,
    source: "gdelt",
    source_url: article.url ?? "",
    title: article.title ?? "Untitled GDELT article",
    outlet,
    published_at: parseGdeltSeenDate(article.seendate),
    fetched_at: fetchedAt,
    summary: article.summary ?? article.title ?? "",
    language: article.language ?? "unknown",
    country_iso3_list: countries,
    relationship_pair_list: relationships,
    topics,
    entities: article.entities ?? [],
    event_type: topics[0] ?? null,
    sentiment_tone: article.tone ?? null,
    relevance_score: relevance,
    source_quality_score: quality,
    confidence: inferConfidence(relevance, quality),
    raw_record_path: rawRecordPath,
  };
}

export function newsRecordToIncludedRecord(record: NewsEvidenceRecord) {
  return {
    record_id: record.evidence_record_id,
    source_id: "gdelt_news_events",
    label: `${record.outlet} (${record.published_at.slice(0, 10)})`,
    year: new Date(record.published_at).getUTCFullYear(),
    date: record.published_at.slice(0, 10),
    value_summary: record.title,
  };
}
