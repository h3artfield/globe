import type { CountryModule, MetricValue, ReviewQueueItem } from "@/types/pipeline";
import { COUNTRY_MODULES } from "@/lib/pipeline/constants";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { getMetricModule } from "@/lib/pipeline/countryModules";
import { pathExists, readJsonFile, readJsonLinesFile, repoPath, writeJsonFile, writeJsonLinesFile } from "@/lib/pipeline/io";
import { buildReviewQueueItem, loadCountryReviewQueue } from "@/lib/pipeline/reviewQueue";
import type { ProcessedMetricsFile } from "@/lib/pipeline/metrics";
import { claimFromMetric } from "./claimExtractor";
import { detectModuleMissingData } from "./missingDataDetector";
import { validateDossierModule } from "./moduleDraftValidator";
import { claimHasGrounding } from "./sourceGrounding";
import { writeDossierBuildReport, type DossierBuildReport } from "./dossierBuildReport";

async function loadMetrics(countryCode: string): Promise<MetricValue[]> {
  const filePath = repoPath("data", "processed", "countries", countryCode, "metrics.v1.json");
  if (!(await pathExists(filePath))) return [];
  return (await readJsonFile<ProcessedMetricsFile>(filePath)).metrics;
}

async function loadModule(countryCode: string, moduleName: string): Promise<CountryModule> {
  const filePath = repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`);
  if (await pathExists(filePath)) return readJsonFile<CountryModule>(filePath);
  return {
    country_code: countryCode,
    module: moduleName,
    version: "1.0",
    last_updated: new Date().toISOString().slice(0, 10),
    summary: "",
    key_findings: [],
    metrics: [],
    claims: [],
    open_questions: [],
    source_ids: [],
    review_status: "human_review_pending",
    confidence: { overall: "unknown", weak_areas: ["sources"] },
  };
}

function metricsForModule(metrics: MetricValue[], moduleName: string): MetricValue[] {
  if (moduleName === "scorecard") return metrics;
  return metrics.filter((metric) => getMetricModule(metric.metric_id) === moduleName);
}

export async function buildCountryModuleDossier(countryCode: string, moduleName: string) {
  const metrics = metricsForModule(await loadMetrics(countryCode), moduleName);
  const existing = await loadModule(countryCode, moduleName);
  const claims = metrics.map((metric, index) => claimFromMetric(countryCode, moduleName, metric, index));
  const sourceIds = Array.from(new Set([...existing.source_ids, ...metrics.flatMap((metric) => metric.source_id ? [metric.source_id] : [])])).sort();
  const module: CountryModule = {
    ...existing,
    last_updated: new Date().toISOString().slice(0, 10),
    metrics,
    claims,
    key_findings: claims.map((claim) => claim.text),
    source_ids: sourceIds,
    review_status: claims.length > 0 ? "auto_generated_from_structured_data" : "human_review_pending",
    confidence: {
      overall: claims.length > 0 ? "medium" : "unknown",
      weak_areas: claims.length > 0 ? ["narrative_context"] : ["sources", "claims"],
    },
  };

  const validation = validateDossierModule(module);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("\n"));
  }

  await writeJsonFile(repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`), module);
  return { module, validation };
}

export async function buildCountryDossier(countryCode: string, moduleFilter?: string[]) {
  const modulesAttempted = moduleFilter?.length ? moduleFilter : [...COUNTRY_MODULES];
  const modulesGenerated: string[] = [];
  const modulesSkipped: string[] = [];
  const missingData: string[] = [];
  const weakSources: string[] = [];
  const reviewQueueItems: ReviewQueueItem[] = await loadCountryReviewQueue(countryCode);
  const chunks = [];
  let claimsGenerated = 0;
  let claimsWithSources = 0;
  let claimsRejected = 0;

  for (const moduleName of modulesAttempted) {
    const { module, validation } = await buildCountryModuleDossier(countryCode, moduleName);
    modulesGenerated.push(moduleName);
    claimsGenerated += module.claims.length;
    claimsWithSources += module.claims.filter(claimHasGrounding).length;
    claimsRejected += validation.rejectedClaims.length;
    missingData.push(...detectModuleMissingData(module));
    weakSources.push(...validation.warnings);
    chunks.push(buildCountryChunk(module, modulesGenerated.length));

    if (module.claims.length === 0) {
      reviewQueueItems.push(buildReviewQueueItem(countryCode, moduleName, reviewQueueItems.length + 1));
    }
  }

  const existingChunksPath = repoPath("data", "rag", "countries", countryCode, "chunks.jsonl");
  const existingChunks = (await pathExists(existingChunksPath))
    ? await readJsonLinesFile<ReturnType<typeof buildCountryChunk>>(existingChunksPath)
    : [];
  const moduleSet = new Set(modulesAttempted);
  await writeJsonLinesFile(existingChunksPath, [
    ...existingChunks.filter((chunk) => !moduleSet.has(chunk.module)),
    ...chunks,
  ]);
  await writeJsonFile(repoPath("data", "review_queue", "countries", `${countryCode}.json`), {
    country_code: countryCode,
    generated_at: new Date().toISOString(),
    items: reviewQueueItems,
  });

  const report: DossierBuildReport = {
    country_code: countryCode,
    modules_attempted: modulesAttempted,
    modules_generated: modulesGenerated,
    modules_skipped: modulesSkipped,
    claims_generated: claimsGenerated,
    claims_with_sources: claimsWithSources,
    claims_rejected: claimsRejected,
    review_items_created: reviewQueueItems.length,
    missing_data: Array.from(new Set(missingData)).sort(),
    weak_sources: Array.from(new Set(weakSources)).sort(),
    next_recommended_sources: ["manual_leader_sources", "news_manual", "treaties_manual", "world_values_survey"],
  };
  await writeDossierBuildReport(report);
  return report;
}
