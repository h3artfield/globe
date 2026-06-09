import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ReplayJudgeAudit } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const AUDITS_DIR = repoPath("data", "forecasting", "audits");

function auditFilePath(sessionId: string): string {
  return path.join(AUDITS_DIR, sessionId, "judge_audit.v1.json");
}

export function createJudgeAuditId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `judge_${stamp}_${suffix}`;
}

export async function saveReplayJudgeAudit(audit: ReplayJudgeAudit): Promise<void> {
  await writeJsonFile(auditFilePath(audit.session_id), audit);
}

export async function loadReplayJudgeAudit(sessionId: string): Promise<ReplayJudgeAudit | null> {
  const filePath = auditFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayJudgeAudit>(filePath);
}
