import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CountryModule, CoverageReport, RelationshipModule } from "@/types/pipeline";
import type { ModuleCompletionStatus } from "@/types/kb";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { COUNTRY_MODULES, MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import { listDirectories, pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

export type TargetInventory = {
  target_id: string;
  target_type: "country" | "relationship";
  coverage: CoverageReport | null;
  moduleNames: string[];
  manualSourceFiles: string[];
  manualImportFiles: string[];
  processedFiles: string[];
  rawFiles: string[];
};

async function listFilesRecursive(root: string, skipReadme = true): Promise<string[]> {
  const results: string[] = [];
  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (skipReadme && entry.name.toLowerCase() === "readme.md") continue;
      results.push(fullPath);
    }
  }
  if (await pathExists(root)) await walk(root);
  return results.sort();
}

function toRepoRelative(absolutePath: string): string {
  const cwd = process.cwd();
  return absolutePath.startsWith(cwd) ? path.relative(cwd, absolutePath).replace(/\\/g, "/") : absolutePath;
}

export function deriveModuleStatus(
  moduleName: string,
  coverage: CoverageReport | null,
  modulePayload: CountryModule | RelationshipModule | null,
): ModuleCompletionStatus {
  if (coverage) {
    if (coverage.modules_complete.includes(moduleName)) return "complete";
    if (coverage.modules_partial.includes(moduleName)) return "partial";
    if (coverage.modules_missing.includes(moduleName)) {
      const hasClaims = (modulePayload?.claims.length ?? 0) > 0;
      const hasMetrics = (modulePayload?.metrics.length ?? 0) > 0;
      const hasSources = (modulePayload?.source_ids.length ?? 0) > 0;
      if (!hasClaims && !hasMetrics && !hasSources) return "stub";
      return "missing";
    }
  }
  const hasClaims = (modulePayload?.claims.length ?? 0) > 0;
  const hasMetrics = (modulePayload?.metrics.length ?? 0) > 0;
  if (hasClaims || hasMetrics) return "partial";
  return "stub";
}

async function loadCountryModule(countryCode: string, moduleName: string): Promise<CountryModule | null> {
  const filePath = repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`);
  return (await pathExists(filePath)) ? readJsonFile<CountryModule>(filePath) : null;
}

async function loadRelationshipModule(relationshipId: string, moduleName: string): Promise<RelationshipModule | null> {
  const filePath = repoPath("data", "rag", "relationships", relationshipId, `${moduleName}.v1.json`);
  return (await pathExists(filePath)) ? readJsonFile<RelationshipModule>(filePath) : null;
}

export async function buildCountryInventory(countryCode: string): Promise<TargetInventory> {
  const coveragePath = repoPath("data", "rag", "countries", countryCode, "coverage_report.v1.json");
  const coverage = (await pathExists(coveragePath)) ? await readJsonFile<CoverageReport>(coveragePath) : null;
  const manualSourceFiles = await listFilesRecursive(
    repoPath("data", "manual_sources", "countries", countryCode),
  );
  const manualImportFiles = (await listFilesRecursive(repoPath("data", "manual_imports"))).map(toRepoRelative);
  const processedFiles = (await listFilesRecursive(repoPath("data", "processed", "countries", countryCode))).map(
    toRepoRelative,
  );
  const rawFiles = (await listFilesRecursive(repoPath("data", "raw"))).map(toRepoRelative);

  return {
    target_id: countryCode,
    target_type: "country",
    coverage,
    moduleNames: [...COUNTRY_MODULES],
    manualSourceFiles: manualSourceFiles.map(toRepoRelative),
    manualImportFiles,
    processedFiles,
    rawFiles,
  };
}

export async function buildRelationshipInventory(relationshipId: string): Promise<TargetInventory> {
  const coveragePath = repoPath("data", "rag", "relationships", relationshipId, "coverage_report.v1.json");
  const coverage = (await pathExists(coveragePath)) ? await readJsonFile<CoverageReport>(coveragePath) : null;
  const manualSourceFiles = await listFilesRecursive(
    repoPath("data", "manual_sources", "relationships", relationshipId),
  );
  const manualImportFiles = (await listFilesRecursive(repoPath("data", "manual_imports"))).map(toRepoRelative);
  const processedFiles: string[] = [];
  const rawFiles = (await listFilesRecursive(repoPath("data", "raw"))).map(toRepoRelative);

  return {
    target_id: relationshipId,
    target_type: "relationship",
    coverage,
    moduleNames: [...RELATIONSHIP_MODULES],
    manualSourceFiles: manualSourceFiles.map(toRepoRelative),
    manualImportFiles,
    processedFiles,
    rawFiles,
  };
}

export async function loadModulePayload(
  targetType: "country" | "relationship",
  targetId: string,
  moduleName: string,
): Promise<CountryModule | RelationshipModule | null> {
  return targetType === "country"
    ? loadCountryModule(targetId, moduleName)
    : loadRelationshipModule(targetId, moduleName);
}

export async function buildAllInventories(): Promise<{ countries: TargetInventory[]; relationships: TargetInventory[] }> {
  const countries = await Promise.all(MVP_COUNTRIES.map((code) => buildCountryInventory(code)));
  const relationships = await Promise.all(
    MVP_RELATIONSHIP_PAIRS.map(([a, b]) => buildRelationshipInventory(buildRelationshipId(a, b))),
  );
  return { countries, relationships };
}

export async function listRequirementModuleNames(
  targetType: "country" | "relationship",
  targetId: string,
): Promise<string[]> {
  const requirementsPath =
    targetType === "country"
      ? repoPath("data", "source_requirements", "countries", `${targetId}.source_requirements.v1.json`)
      : repoPath("data", "source_requirements", "relationships", `${targetId}.source_requirements.v1.json`);

  if (!(await pathExists(requirementsPath))) {
    return targetType === "country" ? [...COUNTRY_MODULES] : [...RELATIONSHIP_MODULES];
  }

  const requirements = await readJsonFile<{ modules: Array<{ module: string }> }>(requirementsPath);
  return requirements.modules.map((entry) => entry.module);
}

export async function listManualImportSourceFolders(): Promise<string[]> {
  return listDirectories(repoPath("data", "manual_imports"));
}
