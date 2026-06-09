import type { ModuleSourceRequirement, SourceGapReport } from "@/types/pilot";
import type {
  AcquisitionSlot,
  CountrySourceRequirementsFile,
  KbCompletionMatrix,
  KbModuleMatrixEntry,
  KbTargetMatrixEntry,
  ModuleCompletionStatus,
  RelationshipSourceRequirementsFile,
} from "@/types/kb";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";
import { bestSlotForModule } from "./acquisitionCatalog";
import { countryHasProcessedSource, resolveSourceIngestId } from "./collectionEvidence";
import {
  buildAllInventories,
  deriveModuleStatus,
  listRequirementModuleNames,
  loadModulePayload,
  type TargetInventory,
} from "./moduleInventory";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isStubGapReport(gapReport: SourceGapReport | null): boolean {
  if (!gapReport) return true;
  return (
    gapReport.modules.length === 1 &&
    gapReport.modules[0]?.module === "source_requirements"
  );
}

function averageModuleReadiness(modules: KbModuleMatrixEntry[]): number {
  return Number(
    (modules.reduce((sum, module) => sum + module.readiness_score, 0) / Math.max(1, modules.length)).toFixed(2),
  );
}

function statusReadinessScore(status: ModuleCompletionStatus): number {
  if (status === "complete") return 1;
  if (status === "partial") return 0.45;
  if (status === "missing") return 0.2;
  return 0;
}

function moduleReadinessFromGap(
  moduleName: string,
  gapReport: SourceGapReport | null,
  status: ModuleCompletionStatus,
): number {
  const statusScore = statusReadinessScore(status);

  if (gapReport && !isStubGapReport(gapReport)) {
    const gap = gapReport.modules.find((entry) => entry.module === moduleName);
    if (gap) {
      if (status === "partial" || status === "complete") {
        return Math.max(gap.readiness, statusScore);
      }
      return gap.readiness;
    }
  }

  if (gapReport) {
    const gap = gapReport.modules.find((entry) => entry.module === moduleName);
    if (gap) return gap.readiness;
  }

  return statusScore;
}

function targetReadinessScore(
  modules: KbModuleMatrixEntry[],
  gapReport: SourceGapReport | null,
  statusCounts: { complete: number; partial: number },
): number {
  const coverageBased = averageModuleReadiness(modules);
  if (!gapReport || isStubGapReport(gapReport)) {
    return coverageBased;
  }

  const gapBased = gapReport.overall_source_readiness;
  if (statusCounts.partial > 0 || statusCounts.complete > 0) {
    return Math.max(gapBased, coverageBased);
  }
  return gapBased;
}

async function sharedSourceFileSatisfied(
  inventory: TargetInventory,
  slot: Pick<AcquisitionSlot, "expected_folder" | "expected_filename" | "shared_source_id">,
): Promise<boolean> {
  if (await pathExists(repoPath(slot.expected_folder, slot.expected_filename))) {
    return true;
  }

  const sourceIngestId = resolveSourceIngestId({
    expected_folder: slot.expected_folder,
    shared_source_id: slot.shared_source_id ?? "",
  });
  if (!sourceIngestId) {
    return false;
  }

  if (inventory.target_type === "country") {
    return countryHasProcessedSource(inventory.target_id, sourceIngestId);
  }

  return inventory.manualImportFiles.some((file) =>
    file.replace(/\\/g, "/").includes(slot.expected_filename),
  );
}

async function missingFilesForModule(
  inventory: TargetInventory,
  slot: AcquisitionSlot | null,
): Promise<string[]> {
  const missing: string[] = [];
  if (slot) {
    const expected = `${slot.expected_folder}/${slot.expected_filename}`.replace(/\\/g, "/");
    const exists = slot.shared_source_id
      ? await sharedSourceFileSatisfied(inventory, slot)
      : inventory.manualSourceFiles.some((file) =>
          file.replace(/\\/g, "/").endsWith(expected.split("/").slice(-1)[0] ?? ""),
        ) ||
        inventory.manualImportFiles.some((file) =>
          file.replace(/\\/g, "/").includes(slot.expected_filename),
        );
    if (!exists) missing.push(expected);
  }
  if (inventory.manualSourceFiles.length === 0 && inventory.target_type === "country") {
    missing.push(`data/manual_sources/countries/${inventory.target_id}/`);
  }
  if (inventory.manualSourceFiles.length === 0 && inventory.target_type === "relationship") {
    missing.push(`data/manual_sources/relationships/${inventory.target_id}/`);
  }
  return Array.from(new Set(missing));
}

async function loadRequirements(
  targetType: "country" | "relationship",
  targetId: string,
): Promise<ModuleSourceRequirement[]> {
  const requirementsPath =
    targetType === "country"
      ? repoPath("data", "source_requirements", "countries", `${targetId}.source_requirements.v1.json`)
      : repoPath("data", "source_requirements", "relationships", `${targetId}.source_requirements.v1.json`);

  if (!(await pathExists(requirementsPath))) return [];

  if (targetType === "country") {
    const file = await readJsonFile<CountrySourceRequirementsFile>(requirementsPath);
    return file.modules;
  }
  const file = await readJsonFile<RelationshipSourceRequirementsFile>(requirementsPath);
  return file.modules;
}

async function loadGapReport(
  targetType: "country" | "relationship",
  targetId: string,
): Promise<SourceGapReport | null> {
  const gapPath =
    targetType === "country"
      ? repoPath("data", "reports", "source_gaps", "countries", `${targetId}.source_gaps.v1.json`)
      : repoPath("data", "reports", "source_gaps", "relationships", `${targetId}.source_gaps.v1.json`);
  return (await pathExists(gapPath)) ? readJsonFile<SourceGapReport>(gapPath) : null;
}

async function buildTargetMatrix(
  inventory: TargetInventory,
): Promise<KbTargetMatrixEntry> {
  const requirements = await loadRequirements(inventory.target_type, inventory.target_id);
  const gapReport = await loadGapReport(inventory.target_type, inventory.target_id);
  const moduleNames = await listRequirementModuleNames(inventory.target_type, inventory.target_id);
  const requirementByModule = new Map(requirements.map((entry) => [entry.module, entry]));
  const modules: KbModuleMatrixEntry[] = [];

  for (const moduleName of moduleNames) {
    const requirement = requirementByModule.get(moduleName);
    const payload = await loadModulePayload(inventory.target_type, inventory.target_id, moduleName);
    const status = deriveModuleStatus(moduleName, inventory.coverage, payload);
    const slot = bestSlotForModule(inventory.target_type, inventory.target_id, moduleName);
    const existing = [
      ...inventory.manualSourceFiles,
      ...inventory.processedFiles,
      ...inventory.rawFiles.filter((file) => !file.includes("NO_MANUAL_FILES")),
    ];
    const moduleEntry: KbModuleMatrixEntry = {
      module: moduleName,
      status,
      required_source_categories: requirement?.required_source_types ?? [],
      existing_source_files: existing,
      missing_source_files: await missingFilesForModule(inventory, slot),
      readiness_score: Number(moduleReadinessFromGap(moduleName, gapReport, status).toFixed(2)),
      next_best_source: slot
        ? {
            queue_id: slot.queue_id,
            source_title: slot.source_title,
            source_org: slot.source_org,
            source_type: slot.source_type,
            expected_folder: slot.expected_folder,
            expected_filename: slot.expected_filename,
            shared_source_id: slot.shared_source_id,
          }
        : null,
    };
    modules.push(moduleEntry);
  }

  const statusCounts = { complete: 0, partial: 0, missing: 0, stub: 0 };
  for (const module of modules) {
    statusCounts[module.status] += 1;
  }

  const readinessScore = targetReadinessScore(modules, gapReport, statusCounts);

  return {
    target_id: inventory.target_id,
    target_type: inventory.target_type,
    readiness_score: clamp01(readinessScore),
    modules_complete: statusCounts.complete,
    modules_partial: statusCounts.partial,
    modules_missing: statusCounts.missing,
    modules_stub: statusCounts.stub,
    modules,
  };
}

export async function buildCompletionMatrix(): Promise<KbCompletionMatrix> {
  const inventories = await buildAllInventories();
  const countries: Record<string, KbTargetMatrixEntry> = {};
  const relationships: Record<string, KbTargetMatrixEntry> = {};

  for (const inventory of inventories.countries) {
    countries[inventory.target_id] = await buildTargetMatrix(inventory);
  }
  for (const inventory of inventories.relationships) {
    relationships[inventory.target_id] = await buildTargetMatrix(inventory);
  }

  const countryScores = Object.values(countries).map((entry) => entry.readiness_score);
  const relationshipScores = Object.values(relationships).map((entry) => entry.readiness_score);

  return {
    version: "1.0",
    generated_at: new Date().toISOString(),
    summary: {
      countries_tracked: MVP_COUNTRIES.length,
      relationships_tracked: MVP_RELATIONSHIP_PAIRS.length,
      average_country_readiness: Number(
        (countryScores.reduce((sum, score) => sum + score, 0) / Math.max(1, countryScores.length)).toFixed(2),
      ),
      average_relationship_readiness: Number(
        (relationshipScores.reduce((sum, score) => sum + score, 0) / Math.max(1, relationshipScores.length)).toFixed(
          2,
        ),
      ),
      queue_items_needed: 0,
      shared_datasets_needed: 0,
    },
    countries,
    relationships,
  };
}
