import { randomBytes } from "node:crypto";
import path from "node:path";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { PolymarketMarketRefresh } from "@/types/forecasting";
import { pathExists, repoPath } from "@/lib/pipeline/io";

const REFRESHES_JSONL = repoPath(
  "data",
  "forecasting",
  "question_sources",
  "polymarket",
  "market_refreshes.v1.jsonl",
);

export function createMarketRefreshId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `pm_refresh_${stamp}_${suffix}`;
}

export async function appendMarketRefresh(refresh: PolymarketMarketRefresh): Promise<void> {
  await mkdir(path.dirname(REFRESHES_JSONL), { recursive: true });
  await appendFile(REFRESHES_JSONL, `${JSON.stringify(refresh)}\n`, "utf8");
}

export async function loadMarketRefreshesForMarket(
  sourceMarketId: string,
  limit = 20,
): Promise<PolymarketMarketRefresh[]> {
  if (!(await pathExists(REFRESHES_JSONL))) {
    return [];
  }
  const raw = await readFile(REFRESHES_JSONL, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PolymarketMarketRefresh)
    .filter((row) => row.source_market_id === sourceMarketId);
  return rows.slice(-limit).reverse();
}

export function getMarketRefreshesJsonlPath(): string {
  return REFRESHES_JSONL;
}

export async function loadLatestMarketRefresh(
  sourceMarketId: string,
): Promise<PolymarketMarketRefresh | null> {
  const rows = await loadMarketRefreshesForMarket(sourceMarketId, 1);
  return rows[0] ?? null;
}

export async function listRecentMarketRefreshes(limit = 20): Promise<PolymarketMarketRefresh[]> {
  if (!(await pathExists(REFRESHES_JSONL))) {
    return [];
  }
  const raw = await readFile(REFRESHES_JSONL, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PolymarketMarketRefresh);
  return rows.slice(-limit).reverse();
}
