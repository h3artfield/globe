import type { PilotReadinessReport, SourceGapReport } from "@/types/pilot";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

export async function buildPilotReadiness(targetId: string, targetType: "country" | "relationship"): Promise<PilotReadinessReport> {
  const gapPath = targetType === "country"
    ? repoPath("data", "reports", "source_gaps", "countries", `${targetId}.source_gaps.v1.json`)
    : repoPath("data", "reports", "source_gaps", "relationships", `${targetId}.source_gaps.v1.json`);
  const gapReport = await readJsonFile<SourceGapReport>(gapPath);
  const failed = gapReport.modules.filter((module) => module.readiness < 0.75);
  const retrievalReady = await pathExists(targetType === "country"
    ? repoPath("data", "vector", "countries", targetId, "chunks.embeddings.jsonl")
    : repoPath("data", "vector", "relationships", targetId, "chunks.embeddings.jsonl"));
  const failedGates = [
    ...failed.map((module) => `${module.module}_source_coverage`),
    retrievalReady ? null : "retrieval_embeddings_missing",
    gapReport.overall_source_readiness < 0.75 ? "overall_source_readiness" : null,
  ].filter((gate): gate is string => Boolean(gate));
  const report: PilotReadinessReport = {
    target_id: targetId,
    pilot_ready: failedGates.length === 0,
    overall_score: Number(gapReport.overall_source_readiness.toFixed(2)),
    failed_gates: failedGates,
    next_actions: failed.slice(0, 8).map((module) => module.recommendation),
  };
  const outPath = targetType === "country"
    ? repoPath("data", "pilots", "countries", targetId, "readiness.v1.json")
    : repoPath("data", "pilots", "relationships", targetId, "readiness.v1.json");
  await writeJsonFile(outPath, report);
  return report;
}
