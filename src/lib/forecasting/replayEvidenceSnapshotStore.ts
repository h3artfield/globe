import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ReplayEvidenceSnapshot } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const SNAPSHOTS_DIR = repoPath("data", "forecasting", "evidence_snapshots");

function snapshotFilePath(sessionId: string): string {
  return path.join(SNAPSHOTS_DIR, sessionId, "snapshot.v1.json");
}

export function createEvidenceSnapshotId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `evidence_${stamp}_${suffix}`;
}

export async function saveReplayEvidenceSnapshot(
  snapshot: ReplayEvidenceSnapshot,
): Promise<void> {
  await writeJsonFile(snapshotFilePath(snapshot.session_id), snapshot);
}

export async function loadReplayEvidenceSnapshot(
  sessionId: string,
): Promise<ReplayEvidenceSnapshot | null> {
  const filePath = snapshotFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayEvidenceSnapshot>(filePath);
}
