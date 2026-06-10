import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import type {
  ForecastQuestionSourceMarket,
  PolymarketQuestionQuery,
} from "@/types/forecasting";
import { pathExists, repoPath } from "@/lib/pipeline/io";

const JSONL_PATH = repoPath(
  "data",
  "forecasting",
  "question_sources",
  "polymarket",
  "questions.v1.jsonl",
);
const DB_PATH = repoPath("data", "db", "forecast_questions.sqlite");

function ensureDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS forecast_questions (
      source_market_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      question_text TEXT NOT NULL,
      resolution_status TEXT NOT NULL,
      volume REAL,
      liquidity REAL,
      end_date TEXT,
      implied_probability REAL,
      imported_at TEXT NOT NULL,
      source_url TEXT NOT NULL,
      event_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      condition_id TEXT,
      json_record TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fq_category ON forecast_questions(category);
    CREATE INDEX IF NOT EXISTS idx_fq_status ON forecast_questions(resolution_status);
    CREATE INDEX IF NOT EXISTS idx_fq_end_date ON forecast_questions(end_date);
    CREATE INDEX IF NOT EXISTS idx_fq_volume ON forecast_questions(volume);
    CREATE INDEX IF NOT EXISTS idx_fq_liquidity ON forecast_questions(liquidity);
    CREATE INDEX IF NOT EXISTS idx_fq_imported_at ON forecast_questions(imported_at);
  `);
}

function openDb(): Database.Database {
  const dbDir = path.dirname(DB_PATH);
  void mkdir(dbDir, { recursive: true });
  const db = new Database(DB_PATH);
  ensureDb(db);
  return db;
}

export async function appendQuestionsJsonl(questions: ForecastQuestionSourceMarket[]): Promise<void> {
  await mkdir(path.dirname(JSONL_PATH), { recursive: true });
  if (questions.length === 0) {
    return;
  }
  const lines = questions.map((question) => JSON.stringify(question)).join("\n") + "\n";
  await writeFile(JSONL_PATH, lines, { flag: "a", encoding: "utf8" });
}

export async function replaceQuestionsJsonl(questions: ForecastQuestionSourceMarket[]): Promise<void> {
  await mkdir(path.dirname(JSONL_PATH), { recursive: true });
  const content = questions.map((question) => JSON.stringify(question)).join("\n");
  await writeFile(JSONL_PATH, content ? `${content}\n` : "", "utf8");
}

export function upsertQuestionIndex(questions: ForecastQuestionSourceMarket[]): number {
  const db = openDb();
  const stmt = db.prepare(`
    INSERT INTO forecast_questions (
      source_market_id, source, category, title, question_text, resolution_status,
      volume, liquidity, end_date, implied_probability, imported_at, source_url,
      event_id, market_id, condition_id, json_record
    ) VALUES (
      @source_market_id, @source, @category, @title, @question_text, @resolution_status,
      @volume, @liquidity, @end_date, @implied_probability, @imported_at, @source_url,
      @event_id, @market_id, @condition_id, @json_record
    )
    ON CONFLICT(source_market_id) DO UPDATE SET
      category = excluded.category,
      title = excluded.title,
      question_text = excluded.question_text,
      resolution_status = excluded.resolution_status,
      volume = excluded.volume,
      liquidity = excluded.liquidity,
      end_date = excluded.end_date,
      implied_probability = excluded.implied_probability,
      imported_at = excluded.imported_at,
      source_url = excluded.source_url,
      event_id = excluded.event_id,
      market_id = excluded.market_id,
      condition_id = excluded.condition_id,
      json_record = excluded.json_record
  `);

  const tx = db.transaction((rows: ForecastQuestionSourceMarket[]) => {
    for (const question of rows) {
      stmt.run({
        source_market_id: question.source_market_id,
        source: question.source,
        category: question.category,
        title: question.title,
        question_text: question.question_text,
        resolution_status: question.resolution_status,
        volume: question.volume,
        liquidity: question.liquidity,
        end_date: question.end_date,
        implied_probability: question.implied_probability,
        imported_at: question.imported_at,
        source_url: question.source_url,
        event_id: question.event_id,
        market_id: question.market_id,
        condition_id: question.condition_id,
        json_record: JSON.stringify(question),
      });
    }
  });
  tx(questions);
  db.close();
  return questions.length;
}

export function queryPolymarketQuestions(
  query: PolymarketQuestionQuery,
): ForecastQuestionSourceMarket[] {
  const db = openDb();
  const clauses: string[] = ["source = 'polymarket'"];
  const params: Record<string, string | number> = {};

  if (query.category) {
    clauses.push("category = @category");
    params.category = query.category;
  }
  if (query.status) {
    clauses.push("resolution_status = @status");
    params.status = query.status;
  }
  if (query.min_volume != null) {
    clauses.push("(volume IS NOT NULL AND volume >= @min_volume)");
    params.min_volume = query.min_volume;
  }
  if (query.min_liquidity != null) {
    clauses.push("(liquidity IS NOT NULL AND liquidity >= @min_liquidity)");
    params.min_liquidity = query.min_liquidity;
  }
  if (query.closing_before) {
    clauses.push("(end_date IS NOT NULL AND end_date <= @closing_before)");
    params.closing_before = query.closing_before;
  }
  if (query.closing_after) {
    clauses.push("(end_date IS NOT NULL AND end_date >= @closing_after)");
    params.closing_after = query.closing_after;
  }

  const sortColumn =
    query.sort === "liquidity"
      ? "liquidity"
      : query.sort === "end_date"
        ? "end_date"
        : query.sort === "imported_at"
          ? "imported_at"
          : "volume";
  const limit = query.limit ?? 100;

  let sql = `SELECT json_record FROM forecast_questions WHERE ${clauses.join(" AND ")} ORDER BY COALESCE(${sortColumn}, -1) DESC LIMIT ${limit}`;
  let rows = db.prepare(sql).all(params) as Array<{ json_record: string }>;

  db.close();

  let questions = rows.map((row) => JSON.parse(row.json_record) as ForecastQuestionSourceMarket);

  if (query.country) {
    const country = query.country.toUpperCase();
    questions = questions.filter((question) =>
      question.related_country_iso3_list.includes(country),
    );
  }
  if (query.relationship) {
    const relationship = query.relationship.toUpperCase();
    questions = questions.filter((question) =>
      question.related_relationship_pair_list.includes(relationship),
    );
  }
  if (query.topic) {
    const topic = query.topic.toLowerCase();
    questions = questions.filter(
      (question) =>
        question.topics.some((item) => item.toLowerCase() === topic) ||
        question.tags.some((item) => item.toLowerCase() === topic),
    );
  }

  return questions;
}

export function getPolymarketQuestionById(
  sourceMarketId: string,
): ForecastQuestionSourceMarket | null {
  const db = openDb();
  const row = db
    .prepare("SELECT json_record FROM forecast_questions WHERE source_market_id = ?")
    .get(sourceMarketId) as { json_record: string } | undefined;
  db.close();
  return row ? (JSON.parse(row.json_record) as ForecastQuestionSourceMarket) : null;
}

export async function loadQuestionsJsonl(): Promise<ForecastQuestionSourceMarket[]> {
  if (!(await pathExists(JSONL_PATH))) {
    return [];
  }
  const raw = await readFile(JSONL_PATH, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ForecastQuestionSourceMarket);
}

export function getQuestionStorePaths(): { jsonlPath: string; dbPath: string } {
  return { jsonlPath: JSONL_PATH, dbPath: DB_PATH };
}
