import type { CoverageReport } from "@/types/pipeline";
import type { PilotCompletionScore } from "@/types/pilot";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export async function buildCountryCompletionScore(countryCode: string): Promise<PilotCompletionScore> {
  const coverage = await readJsonFile<CoverageReport>(repoPath("data", "rag", "countries", countryCode, "coverage_report.v1.json"));
  const eventTimelineCoverage = coverage.modules_missing.includes("top_national_events_20_years") ? 0 : 40;
  const reviewQuality = coverage.review_queue_items.length > 0 ? 20 : 60;
  const citationQuality = coverage.provenance_score ?? 0;
  const retrievalQuality = (await pathExists(repoPath("data", "vector", "countries", countryCode, "chunks.embeddings.jsonl"))) ? 80 : 0;
  const score: PilotCompletionScore = {
    scope_id: countryCode,
    structured_metrics_coverage: coverage.structured_data_score ?? 0,
    narrative_module_coverage: coverage.narrative_data_score ?? 0,
    event_timeline_coverage: eventTimelineCoverage,
    relationship_coverage: 0,
    citation_quality: citationQuality,
    review_quality: reviewQuality,
    retrieval_quality: retrievalQuality,
    overall_pilot_readiness: average([coverage.structured_data_score ?? 0, coverage.narrative_data_score ?? 0, eventTimelineCoverage, citationQuality, reviewQuality, retrievalQuality]),
    notes: ["Completion depends on source-backed claims, reviewed claims, fresh metrics, event coverage, relationship coverage, and golden evals."],
  };
  await writeJsonFile(repoPath("data", "pilots", "countries", countryCode, "completion_score.v1.json"), score);
  return score;
}

export async function buildRelationshipCompletionScore(relationshipId: string): Promise<PilotCompletionScore> {
  const hasEmbeddings = await pathExists(repoPath("data", "vector", "relationships", relationshipId, "chunks.embeddings.jsonl"));
  const score: PilotCompletionScore = {
    scope_id: relationshipId,
    structured_metrics_coverage: 0,
    narrative_module_coverage: 0,
    event_timeline_coverage: 0,
    relationship_coverage: 20,
    citation_quality: 0,
    review_quality: 20,
    retrieval_quality: hasEmbeddings ? 80 : 0,
    overall_pilot_readiness: average([20, hasEmbeddings ? 80 : 0]),
    notes: ["Relationship pilot remains source-collection pending until verified EGY/ETH Nile documents are imported."],
  };
  await writeJsonFile(repoPath("data", "pilots", "relationships", relationshipId, "completion_score.v1.json"), score);
  return score;
}
