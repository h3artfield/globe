import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ReplayScorecard } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const SCORECARDS_DIR = repoPath("data", "forecasting", "scorecards");

function scorecardFilePath(sessionId: string): string {
  return path.join(SCORECARDS_DIR, sessionId, "scorecard.v1.json");
}

export function createScorecardId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `scorecard_${stamp}_${suffix}`;
}

export async function saveReplayScorecard(scorecard: ReplayScorecard): Promise<void> {
  await writeJsonFile(scorecardFilePath(scorecard.session_id), scorecard);
}

export async function loadReplayScorecard(sessionId: string): Promise<ReplayScorecard | null> {
  const filePath = scorecardFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayScorecard>(filePath);
}
