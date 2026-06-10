import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import type { GdeltNewsQuery, NewsEvidenceRecord } from "@/types/forecasting";
import { pathExists, repoPath } from "@/lib/pipeline/io";

const JSONL_PATH = repoPath(
  "data",
  "forecasting",
  "evidence_sources",
  "gdelt",
  "news_events.v1.jsonl",
);
const DB_PATH = repoPath("data", "db", "news_evidence.sqlite");

function ensureDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_evidence (
      evidence_record_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      outlet TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      relevance_score REAL,
      source_quality_score REAL,
      confidence TEXT NOT NULL,
      json_record TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ne_published_at ON news_evidence(published_at);
    CREATE INDEX IF NOT EXISTS idx_ne_fetched_at ON news_evidence(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_ne_relevance ON news_evidence(relevance_score);
  `);
}

function openDb(): Database.Database {
  void mkdir(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  ensureDb(db);
  return db;
}

export async function replaceNewsEvidenceJsonl(records: NewsEvidenceRecord[]): Promise<void> {
  await mkdir(path.dirname(JSONL_PATH), { recursive: true });
  const content = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(JSONL_PATH, content ? `${content}\n` : "", "utf8");
}

export async function appendNewsEvidenceJsonl(records: NewsEvidenceRecord[]): Promise<void> {
  if (records.length === 0) {
    return;
  }
  await mkdir(path.dirname(JSONL_PATH), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await writeFile(JSONL_PATH, lines, { flag: "a", encoding: "utf8" });
}

export function upsertNewsEvidenceIndex(records: NewsEvidenceRecord[]): number {
  const db = openDb();
  const stmt = db.prepare(`
    INSERT INTO news_evidence (
      evidence_record_id, source, title, outlet, published_at, fetched_at,
      relevance_score, source_quality_score, confidence, json_record
    ) VALUES (
      @evidence_record_id, @source, @title, @outlet, @published_at, @fetched_at,
      @relevance_score, @source_quality_score, @confidence, @json_record
    )
    ON CONFLICT(evidence_record_id) DO UPDATE SET
      title = excluded.title,
      outlet = excluded.outlet,
      published_at = excluded.published_at,
      fetched_at = excluded.fetched_at,
      relevance_score = excluded.relevance_score,
      source_quality_score = excluded.source_quality_score,
      confidence = excluded.confidence,
      json_record = excluded.json_record
  `);

  const tx = db.transaction((rows: NewsEvidenceRecord[]) => {
    for (const record of rows) {
      stmt.run({
        evidence_record_id: record.evidence_record_id,
        source: record.source,
        title: record.title,
        outlet: record.outlet,
        published_at: record.published_at,
        fetched_at: record.fetched_at,
        relevance_score: record.relevance_score,
        source_quality_score: record.source_quality_score,
        confidence: record.confidence,
        json_record: JSON.stringify(record),
      });
    }
  });
  tx(records);
  db.close();
  return records.length;
}

export function queryNewsEvidence(query: GdeltNewsQuery): NewsEvidenceRecord[] {
  const db = openDb();
  const sortColumn =
    query.sort === "relevance_score"
      ? "relevance_score"
      : query.sort === "fetched_at"
        ? "fetched_at"
        : "published_at";
  const limit = query.limit ?? 50;
  const sql = `SELECT json_record FROM news_evidence WHERE source = 'gdelt' ORDER BY COALESCE(${sortColumn}, 0) DESC LIMIT ${limit}`;
  let rows = db.prepare(sql).all() as Array<{ json_record: string }>;
  db.close();

  let records = rows.map((row) => JSON.parse(row.json_record) as NewsEvidenceRecord);

  if (query.country) {
    const country = query.country.toUpperCase();
    records = records.filter((record) => record.country_iso3_list.includes(country));
  }
  if (query.relationship) {
    const relationship = query.relationship.toUpperCase();
    records = records.filter((record) => record.relationship_pair_list.includes(relationship));
  }
  if (query.topic) {
    const topic = query.topic.toLowerCase();
    records = records.filter(
      (record) => record.topics.some((item) => item.includes(topic)) || record.event_type === topic,
    );
  }
  if (query.query) {
    const terms = query.query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[^a-z0-9]/g, ""))
      .filter((term) => term.length > 3);
    if (terms.length > 0) {
      records = records.filter((record) =>
        terms.some(
          (term) =>
            record.title.toLowerCase().includes(term) ||
            record.summary.toLowerCase().includes(term),
        ),
      );
    }
  }
  if (query.start_date) {
    records = records.filter((record) => record.published_at >= query.start_date!);
  }
  if (query.end_date) {
    records = records.filter((record) => record.published_at <= query.end_date!);
  }

  return records.slice(0, limit);
}

export async function loadNewsEvidenceJsonl(): Promise<NewsEvidenceRecord[]> {
  if (!(await pathExists(JSONL_PATH))) {
    return [];
  }
  const raw = await readFile(JSONL_PATH, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as NewsEvidenceRecord);
}

export function getNewsEvidenceStorePaths(): { jsonlPath: string; dbPath: string } {
  return { jsonlPath: JSONL_PATH, dbPath: DB_PATH };
}
