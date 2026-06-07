import type {
  CountryModule,
  CoverageReport,
  MetricValue,
  RagChunk,
  RelationshipCoverageReport,
  RelationshipModule,
} from "@/types/pipeline";
import { buildCountryPairs, buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { COUNTRY_MODULES, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import { listDirectories, pathExists, readJsonFile, readJsonLinesFile, repoPath } from "@/lib/pipeline/io";

export async function loadCountryCoverage(countryCode: string): Promise<CoverageReport | null> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath("data", "rag", "countries", normalizedCode, "coverage_report.v1.json");
  return (await pathExists(filePath)) ? readJsonFile<CoverageReport>(filePath) : null;
}

export async function loadCountryModules(
  countryCode: string,
  moduleFilter?: string[],
): Promise<CountryModule[]> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const modules: CountryModule[] = [];
  const moduleNames = moduleFilter?.length ? moduleFilter : [...COUNTRY_MODULES];

  for (const moduleName of moduleNames) {
    const filePath = repoPath("data", "rag", "countries", normalizedCode, `${moduleName}.v1.json`);

    if (await pathExists(filePath)) {
      modules.push(await readJsonFile<CountryModule>(filePath));
    }
  }

  return modules;
}

export async function loadCountryScorecard(countryCode: string): Promise<CountryModule | null> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath("data", "rag", "countries", normalizedCode, "scorecard.v1.json");
  return (await pathExists(filePath)) ? readJsonFile<CountryModule>(filePath) : null;
}

export async function loadCountryChunks(countryCode: string): Promise<RagChunk[]> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath("data", "rag", "countries", normalizedCode, "chunks.jsonl");
  return (await pathExists(filePath)) ? readJsonLinesFile<RagChunk>(filePath) : [];
}

export async function loadRelationshipCoverage(
  relationshipId: string,
): Promise<RelationshipCoverageReport | null> {
  const normalizedRelationshipId = normalizeRelationshipId(relationshipId);
  const filePath = repoPath(
    "data",
    "rag",
    "relationships",
    normalizedRelationshipId,
    "coverage_report.v1.json",
  );
  return (await pathExists(filePath)) ? readJsonFile<RelationshipCoverageReport>(filePath) : null;
}

export async function loadRelationshipModules(
  relationshipId: string,
  moduleFilter?: string[],
): Promise<RelationshipModule[]> {
  const normalizedRelationshipId = normalizeRelationshipId(relationshipId);
  const modules: RelationshipModule[] = [];
  const moduleNames = moduleFilter?.length ? moduleFilter : [...RELATIONSHIP_MODULES];

  for (const moduleName of moduleNames) {
    const filePath = repoPath(
      "data",
      "rag",
      "relationships",
      normalizedRelationshipId,
      `${moduleName}.v1.json`,
    );

    if (await pathExists(filePath)) {
      modules.push(await readJsonFile<RelationshipModule>(filePath));
    }
  }

  return modules;
}

export async function loadRelationshipChunks(relationshipId: string): Promise<RagChunk[]> {
  const normalizedRelationshipId = normalizeRelationshipId(relationshipId);
  const filePath = repoPath(
    "data",
    "rag",
    "relationships",
    normalizedRelationshipId,
    "chunks.jsonl",
  );
  return (await pathExists(filePath)) ? readJsonLinesFile<RagChunk>(filePath) : [];
}

export async function listGeneratedCountryCodes(): Promise<string[]> {
  return listDirectories(repoPath("data", "rag", "countries"));
}

export function normalizeRelationshipId(relationshipId: string): string {
  const parts = relationshipId
    .split("_")
    .map(normalizeCountryCode)
    .filter(Boolean);

  if (parts.length !== 2) {
    return normalizeCountryCode(relationshipId);
  }

  return buildRelationshipId(parts[0], parts[1]);
}

export async function loadPipelineAskContext(
  selectedCountries: string[],
  options?: {
    countryModules?: string[];
    relationshipModules?: string[];
  },
) {
  const normalizedCountries = Array.from(new Set(selectedCountries.map(normalizeCountryCode))).sort();
  const relationshipIds = buildCountryPairs(normalizedCountries).map(([countryA, countryB]) =>
    buildRelationshipId(countryA, countryB),
  );
  const countryModules = (
    await Promise.all(
      normalizedCountries.map((countryCode) =>
        loadCountryModules(countryCode, options?.countryModules),
      ),
    )
  ).flat();
  const relationshipModules = (
    await Promise.all(
      relationshipIds.map((relationshipId) =>
        loadRelationshipModules(relationshipId, options?.relationshipModules),
      ),
    )
  ).flat();
  const allCountryChunks = (await Promise.all(normalizedCountries.map(loadCountryChunks))).flat();
  const allRelationshipChunks = (await Promise.all(relationshipIds.map(loadRelationshipChunks))).flat();
  const countryChunkModules = new Set(options?.countryModules ?? COUNTRY_MODULES);
  const relationshipChunkModules = new Set(options?.relationshipModules ?? RELATIONSHIP_MODULES);
  const countryChunks = allCountryChunks.filter((chunk) => countryChunkModules.has(chunk.module));
  const relationshipChunks = allRelationshipChunks.filter((chunk) =>
    relationshipChunkModules.has(chunk.module),
  );
  const countryCoverages = await Promise.all(normalizedCountries.map(loadCountryCoverage));
  const relationshipCoverages = await Promise.all(relationshipIds.map(loadRelationshipCoverage));
  const metrics = countryModules.flatMap((module) => module.metrics);
  const sourceIds = Array.from(
    new Set([
      ...countryModules.flatMap((module) => module.source_ids),
      ...relationshipModules.flatMap((module) => module.source_ids),
      ...countryChunks.flatMap((chunk) => chunk.source_ids),
      ...relationshipChunks.flatMap((chunk) => chunk.source_ids),
    ]),
  ).sort();
  const missingData = [
    ...countryCoverages.flatMap((coverage) => coverage?.modules_missing ?? []),
    ...relationshipCoverages.flatMap((coverage, index) =>
      coverage?.modules_missing ?? [`${relationshipIds[index]}: relationship profile missing`],
    ),
  ];

  return {
    selectedCountries: normalizedCountries,
    relationshipIds,
    countryModules,
    relationshipModules,
    countryChunks,
    relationshipChunks,
    countryCoverages: countryCoverages.filter((coverage): coverage is CoverageReport => coverage !== null),
    relationshipCoverages: relationshipCoverages.filter(
      (coverage): coverage is RelationshipCoverageReport => coverage !== null,
    ),
    metrics,
    sourceIds,
    missingData: Array.from(new Set(missingData)).sort(),
  };
}

export function summarizeMetrics(metrics: MetricValue[]) {
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    const key = `${metric.country_code}:${metric.metric_id}:${metric.year ?? "unknown"}:${metric.source_id ?? "unknown"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).map((metric) => ({
    metric_id: metric.metric_id,
    country_code: metric.country_code,
    year: metric.year,
    source_id: metric.source_id,
    source_name: metric.source_name,
    unit: metric.unit,
  }));
}
