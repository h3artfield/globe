import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ReplayResolution } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const RESOLUTIONS_DIR = repoPath("data", "forecasting", "resolutions");

function resolutionFilePath(sessionId: string): string {
  return path.join(RESOLUTIONS_DIR, sessionId, "resolution.v1.json");
}

export function createResolutionId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `resolution_${stamp}_${suffix}`;
}

export async function saveReplayResolution(resolution: ReplayResolution): Promise<void> {
  await writeJsonFile(resolutionFilePath(resolution.session_id), resolution);
}

export async function loadReplayResolution(sessionId: string): Promise<ReplayResolution | null> {
  const filePath = resolutionFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayResolution>(filePath);
}
