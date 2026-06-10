import { randomBytes } from "node:crypto";
import path from "node:path";
import type { SessionEvidenceAssessment } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const ASSESSMENTS_DIR = repoPath("data", "forecasting", "evidence_assessments");

function assessmentFilePath(sessionId: string): string {
  return path.join(ASSESSMENTS_DIR, sessionId, "assessment.v1.json");
}

export function createEvidenceAssessmentId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `assessment_${stamp}_${suffix}`;
}

export async function saveSessionEvidenceAssessment(
  assessment: SessionEvidenceAssessment,
): Promise<void> {
  await writeJsonFile(assessmentFilePath(assessment.session_id), assessment);
}

export async function loadSessionEvidenceAssessment(
  sessionId: string,
): Promise<SessionEvidenceAssessment | null> {
  const filePath = assessmentFilePath(sessionId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<SessionEvidenceAssessment>(filePath);
}

export function getEvidenceAssessmentFilePath(sessionId: string): string {
  return assessmentFilePath(sessionId);
}
