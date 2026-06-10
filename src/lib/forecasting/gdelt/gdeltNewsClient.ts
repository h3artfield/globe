import path from "node:path";
import { readFile } from "node:fs/promises";
import { isGdeltMockMode, loadGdeltNewsSourceConfig } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import { repoPath } from "@/lib/pipeline/io";

export type GdeltRawArticleRecord = {
  id?: string;
  url?: string;
  title?: string;
  domain?: string;
  language?: string;
  seendate?: string;
  sourcecountry?: string;
  tone?: number;
  themes?: string[];
  entities?: string[];
  summary?: string;
};

export type GdeltFetchOptions = {
  query?: string;
  country?: string;
  relationship?: string;
  topic?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  forceMock?: boolean;
};

function buildDocQuery(options: GdeltFetchOptions): string {
  const parts: string[] = [];
  if (options.query?.trim()) {
    parts.push(options.query.trim());
  }
  if (options.country?.trim()) {
    parts.push(`sourcecountry:${options.country.trim().toUpperCase()}`);
  }
  if (options.topic?.trim()) {
    parts.push(options.topic.trim());
  }
  if (options.relationship?.trim()) {
    const [left, right] = options.relationship.split("_");
    if (left && right) {
      parts.push(`${left} ${right}`);
    }
  }
  return parts.join(" ").trim() || "geopolitics";
}

async function loadMockArticles(options: GdeltFetchOptions): Promise<GdeltRawArticleRecord[]> {
  const config = await loadGdeltNewsSourceConfig();
  const fixturePath = repoPath(...config.mock_fixture_path.split("/"));
  const raw = await readFile(fixturePath, "utf8");
  let articles = JSON.parse(raw) as GdeltRawArticleRecord[];

  if (options.country) {
    const country = options.country.toUpperCase();
    articles = articles.filter(
      (article) =>
        article.sourcecountry?.toUpperCase() === country ||
        (article.entities ?? []).some((entity) => entity.toUpperCase() === country),
    );
  }
  if (options.relationship) {
    const pair = options.relationship.toUpperCase();
    const [left, right] = pair.split("_");
    articles = articles.filter((article) => {
      const entities = (article.entities ?? []).map((entity) => entity.toUpperCase());
      return entities.includes(left) && entities.includes(right);
    });
  }
  if (options.topic) {
    const topic = options.topic.toLowerCase();
    articles = articles.filter((article) =>
      (article.themes ?? []).some((theme) => theme.toLowerCase().includes(topic)),
    );
  }
  if (options.query) {
    const query = options.query.toLowerCase();
    articles = articles.filter(
      (article) =>
        article.title?.toLowerCase().includes(query) ||
        article.summary?.toLowerCase().includes(query),
    );
  }

  const limit = options.limit ?? 50;
  return articles.slice(0, limit);
}

async function fetchLiveArticles(
  baseUrl: string,
  options: GdeltFetchOptions,
): Promise<GdeltRawArticleRecord[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("query", buildDocQuery(options));
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(options.limit ?? 25));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`GDELT DOC API failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { articles?: GdeltRawArticleRecord[] };
  return Array.isArray(payload.articles) ? payload.articles : [];
}

export async function fetchGdeltNewsArticles(
  options: GdeltFetchOptions = {},
): Promise<GdeltRawArticleRecord[]> {
  if (options.forceMock || isGdeltMockMode()) {
    return loadMockArticles(options);
  }

  const config = await loadGdeltNewsSourceConfig();
  return fetchLiveArticles(config.doc_api_base_url, options);
}

export function rawGdeltPathForDate(dateStamp: string, slug: string): string {
  return path.join("data", "raw", "gdelt", dateStamp, `${slug}_news.v1.json`);
}
