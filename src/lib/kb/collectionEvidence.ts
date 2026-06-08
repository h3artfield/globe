import { readdir } from "node:fs/promises";
import path from "node:path";
import type { CollectionStatus, KbQueueItem } from "@/types/kb";
import { listRawImportFiles } from "@/lib/kb/batch1Transform/rawFiles";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

const EVENT_SOURCE_IDS = new Set(["acled", "ucdp", "correlates_of_war"]);

type SourceCoverageFile = {
  source_family_coverage?: Array<{
    source_id: string;
    status: string;
    metrics_available?: string[];
  }>;
};

type ProcessedEventsFile = {
  events?: Array<{
    relationship_id?: string | null;
    country_codes?: string[];
    source_ids?: string[];
  }>;
};

export function resolveSourceIngestId(item: Pick<KbQueueItem, "expected_folder" | "shared_source_id">): string {
  const folderName = path.basename(item.expected_folder.replace(/\\/g, "/"));
  return folderName || item.shared_source_id || "";
}

function isCountryTarget(targetId: string): boolean {
  return /^[A-Z]{3}$/.test(targetId);
}

async function fileExistsInFolder(folder: string, filename: string): Promise<boolean> {
  return pathExists(repoPath(folder, filename));
}

async function hasArchivedRawFiles(sourceIngestId: string): Promise<boolean> {
  const rawSourceDir = repoPath("data", "raw", sourceIngestId);

  async function walk(directory: string): Promise<boolean> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (await walk(fullPath)) {
          return true;
        }
        continue;
      }
      if (entry.name !== "NO_MANUAL_FILES.json") {
        return true;
      }
    }
    return false;
  }

  return walk(rawSourceDir);
}

export async function hasCollectionEvidence(
  item: Pick<KbQueueItem, "expected_folder" | "expected_filename">,
  sourceIngestId: string,
): Promise<boolean> {
  if (await fileExistsInFolder(item.expected_folder, item.expected_filename)) {
    return true;
  }
  if ((await listRawImportFiles(sourceIngestId)).length > 0) {
    return true;
  }
  return hasArchivedRawFiles(sourceIngestId);
}

export async function countryHasProcessedSource(
  countryCode: string,
  sourceIngestId: string,
): Promise<boolean> {
  const coveragePath = repoPath(
    "data",
    "processed",
    "countries",
    countryCode,
    "source_coverage.v1.json",
  );
  if (!(await pathExists(coveragePath))) {
    return false;
  }

  const coverage = await readJsonFile<SourceCoverageFile>(coveragePath);
  const family = coverage.source_family_coverage?.find((entry) => entry.source_id === sourceIngestId);
  if (!family || family.status === "missing") {
    return false;
  }

  return (
    family.status === "available" ||
    family.status === "partial" ||
    (family.metrics_available?.length ?? 0) > 0
  );
}

async function hasProcessedEvents(sourceIngestId: string): Promise<boolean> {
  const eventsPath = repoPath("data", "processed", "events", sourceIngestId, "events.v1.json");
  if (!(await pathExists(eventsPath))) {
    return false;
  }
  const payload = await readJsonFile<ProcessedEventsFile>(eventsPath);
  return (payload.events?.length ?? 0) > 0;
}

async function countryHasProcessedEvents(
  countryCode: string,
  sourceIngestId: string,
): Promise<boolean> {
  const eventsPath = repoPath("data", "processed", "events", sourceIngestId, "events.v1.json");
  if (!(await pathExists(eventsPath))) {
    return false;
  }
  const payload = await readJsonFile<ProcessedEventsFile>(eventsPath);
  return (
    payload.events?.some((event) => event.country_codes?.includes(countryCode)) ?? false
  );
}

async function relationshipHasProcessedEvents(
  relationshipId: string,
  sourceIngestId: string,
): Promise<boolean> {
  const eventsPath = repoPath("data", "processed", "events", sourceIngestId, "events.v1.json");
  if (!(await pathExists(eventsPath))) {
    return false;
  }
  const [countryA, countryB] = relationshipId.split("_");
  const payload = await readJsonFile<ProcessedEventsFile>(eventsPath);
  return (
    payload.events?.some(
      (event) =>
        event.relationship_id === relationshipId ||
        (event.country_codes?.includes(countryA) && event.country_codes?.includes(countryB)),
    ) ?? false
  );
}

export async function hasProcessedImport(
  item: Pick<KbQueueItem, "applies_to_targets" | "expected_folder" | "shared_source_id">,
  sourceIngestId: string,
): Promise<boolean> {
  const targets = item.applies_to_targets ?? [];
  const countryTargets = targets.filter(isCountryTarget);
  const relationshipTargets = targets.filter((targetId) => !isCountryTarget(targetId));

  if (EVENT_SOURCE_IDS.has(sourceIngestId)) {
    if (await hasProcessedEvents(sourceIngestId)) {
      return true;
    }
    for (const countryCode of countryTargets) {
      if (await countryHasProcessedEvents(countryCode, sourceIngestId)) {
        return true;
      }
    }
    for (const relationshipId of relationshipTargets) {
      if (await relationshipHasProcessedEvents(relationshipId, sourceIngestId)) {
        return true;
      }
    }
    return false;
  }

  for (const countryCode of countryTargets) {
    if (await countryHasProcessedSource(countryCode, sourceIngestId)) {
      return true;
    }
  }

  return false;
}

export async function detectCollectionStatus(
  item: Omit<KbQueueItem, "collection_status">,
): Promise<CollectionStatus> {
  const sourceIngestId = resolveSourceIngestId(item);

  if (sourceIngestId && (await hasProcessedImport(item, sourceIngestId))) {
    return "imported";
  }

  if (await hasCollectionEvidence(item, sourceIngestId)) {
    return "found";
  }

  return "needed";
}
