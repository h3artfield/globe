import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { GdeltNewsIngestRequest, NewsEvidenceRecord } from "@/types/forecasting";
import {
  fetchGdeltNewsArticles,
  rawGdeltPathForDate,
  type GdeltFetchOptions,
} from "@/lib/forecasting/gdelt/gdeltNewsClient";
import { isGdeltMockMode, loadGdeltNewsSourceConfig } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import { normalizeGdeltArticle } from "@/lib/forecasting/gdelt/normalizeGdeltNewsEvent";
import {
  appendNewsEvidenceJsonl,
  replaceNewsEvidenceJsonl,
  upsertNewsEvidenceIndex,
} from "@/lib/forecasting/gdelt/newsEvidenceStore";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

export type GdeltIngestResult = {
  imported_count: number;
  used_mock: boolean;
  raw_path: string;
};

function queryTermsFromRequest(request: GdeltNewsIngestRequest): string[] {
  const terms: string[] = [];
  if (request.query) {
    terms.push(...request.query.split(/\s+/).filter(Boolean));
  }
  if (request.topic) {
    terms.push(request.topic);
  }
  return terms;
}

async function saveRawPayload(
  slug: string,
  articles: unknown[],
  dateStamp: string,
): Promise<string> {
  const relativePath = rawGdeltPathForDate(dateStamp, slug);
  const absolutePath = repoPath(...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeJsonFile(absolutePath, {
    fetched_at: new Date().toISOString(),
    slug,
    articles,
  });
  return relativePath.replace(/\\/g, "/");
}

export async function ingestGdeltNews(
  request: GdeltNewsIngestRequest = {},
): Promise<GdeltIngestResult> {
  const config = await loadGdeltNewsSourceConfig();
  const useMock = request.use_mock ?? isGdeltMockMode();
  const fetchedAt = new Date().toISOString();
  const dateStamp = fetchedAt.slice(0, 10);
  const slug = [
    request.country?.toLowerCase(),
    request.relationship?.toLowerCase(),
    request.topic?.toLowerCase(),
  ]
    .filter(Boolean)
    .join("_")
    .replace(/[^a-z0-9_]+/g, "_") || "general";

  const fetchOptions: GdeltFetchOptions = {
    query: request.query,
    country: request.country,
    relationship: request.relationship,
    topic: request.topic,
    startDate: request.start_date,
    endDate: request.end_date,
    limit: request.limit ?? config.max_records_per_ingest,
    forceMock: useMock,
  };

  const articles = await fetchGdeltNewsArticles(fetchOptions);
  const rawPath = await saveRawPayload(slug, articles, dateStamp);
  const queryTerms = queryTermsFromRequest(request);
  const records: NewsEvidenceRecord[] = articles.map((article) =>
    normalizeGdeltArticle(article, fetchedAt, rawPath, queryTerms),
  );

  if (useMock) {
    await replaceNewsEvidenceJsonl(records);
  } else {
    await appendNewsEvidenceJsonl(records);
  }
  upsertNewsEvidenceIndex(records);

  return {
    imported_count: records.length,
    used_mock: useMock,
    raw_path: rawPath,
  };
}
