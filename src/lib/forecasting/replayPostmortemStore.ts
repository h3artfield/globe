import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ReplayPostmortem } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const POSTMORTEMS_DIR = repoPath("data", "forecasting", "postmortems");

function postmortemFilePath(sessionId: string): string {
  return path.join(POSTMORTEMS_DIR, sessionId, "postmortem.v1.json");
}

export function createPostmortemId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `postmortem_${stamp}_${suffix}`;
}

export async function saveReplayPostmortem(postmortem: ReplayPostmortem): Promise<void> {
  await writeJsonFile(postmortemFilePath(postmortem.session_id), postmortem);
}

export async function loadReplayPostmortem(sessionId: string): Promise<ReplayPostmortem | null> {
  const filePath = postmortemFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayPostmortem>(filePath);
}
