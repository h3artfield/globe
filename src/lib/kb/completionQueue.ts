import type {
  CollectionStatus,
  KbCompletionOverrides,
  KbCompletionQueue,
  KbQueueItem,
  KbQueueOverride,
} from "@/types/kb";
import { KB_OVERRIDE_PRESERVE_FIELDS } from "@/types/kb";
import type { KbCompletionMatrix } from "@/types/kb";
import { detectCollectionStatus } from "@/lib/kb/collectionEvidence";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import { getAllAcquisitionSlots } from "./acquisitionCatalog";

const OVERRIDES_PATH = repoPath("data", "source_requests", "kb_completion_overrides.v1.json");
const QUEUE_PATH = repoPath("data", "source_requests", "kb_completion_queue.v1.json");

export async function loadOverrides(): Promise<KbCompletionOverrides> {
  if (!(await pathExists(OVERRIDES_PATH))) {
    return { version: "1.0", last_updated: new Date().toISOString(), overrides: {} };
  }
  return readJsonFile<KbCompletionOverrides>(OVERRIDES_PATH);
}

export async function loadPreviousQueue(): Promise<KbCompletionQueue | null> {
  if (!(await pathExists(QUEUE_PATH))) return null;
  return readJsonFile<KbCompletionQueue>(QUEUE_PATH);
}

function mergeOverride(item: KbQueueItem, override?: KbQueueOverride): KbQueueItem {
  if (!override) return item;
  const merged: KbQueueItem = { ...item };
  for (const field of KB_OVERRIDE_PRESERVE_FIELDS) {
    const value = override[field as keyof KbQueueOverride];
    if (value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[field] = value;
    }
  }
  if (override.collection_status) {
    merged.collection_status = override.collection_status;
  }
  return merged;
}

export async function syncOverridesFromQueue(queue: KbCompletionQueue): Promise<void> {
  const existing = await loadOverrides();
  const nextOverrides = { ...existing.overrides };
  for (const item of queue.items) {
    const existingOverride = existing.overrides[item.queue_id];
    const hasManual =
      item.collection_status === "rejected" ||
      item.collection_status === "found" ||
      item.collection_status === "imported" ||
      Boolean(item.rejected_reason) ||
      Boolean(existingOverride);
    if (!hasManual) continue;
    nextOverrides[item.queue_id] = {
      collection_status: item.collection_status,
      notes: item.notes,
      rejected_reason: item.rejected_reason,
      source_title: item.source_title,
      source_org: item.source_org,
      priority: item.priority,
    };
  }
  await writeJsonFile(OVERRIDES_PATH, {
    version: "1.0",
    last_updated: new Date().toISOString(),
    overrides: nextOverrides,
  } satisfies KbCompletionOverrides);
}

export async function buildCompletionQueue(matrix: KbCompletionMatrix): Promise<KbCompletionQueue> {
  const slots = getAllAcquisitionSlots();
  const overrides = await loadOverrides();

  const items: KbQueueItem[] = [];
  for (const slot of slots) {
    const baseStatus: CollectionStatus = await detectCollectionStatus({
      queue_id: slot.queue_id,
      target_id: slot.target_id ?? slot.shared_source_id ?? "shared",
      target_type: slot.target_type ?? "country",
      module: slot.module,
      source_title: slot.source_title,
      source_org: slot.source_org,
      source_type: slot.source_type,
      expected_folder: slot.expected_folder,
      expected_filename: slot.expected_filename,
      priority: slot.priority,
      notes: slot.notes,
      shared_source_id: slot.shared_source_id,
      applies_to_targets: slot.applies_to_targets,
      target_mappings: slot.target_mappings,
    });

    const draft: KbQueueItem = {
      queue_id: slot.queue_id,
      target_id: slot.target_id ?? slot.shared_source_id ?? "shared",
      target_type: slot.target_type ?? "country",
      module: slot.module,
      source_title: slot.source_title,
      source_org: slot.source_org,
      source_type: slot.source_type,
      expected_folder: slot.expected_folder,
      expected_filename: slot.expected_filename,
      collection_status: baseStatus,
      priority: slot.priority,
      notes: slot.notes,
      shared_source_id: slot.shared_source_id,
      applies_to_targets: slot.applies_to_targets,
      target_mappings: slot.target_mappings,
    };

    items.push(mergeOverride(draft, overrides.overrides[slot.queue_id]));
  }

  items.sort((a, b) => b.priority - a.priority || a.queue_id.localeCompare(b.queue_id));

  const queue: KbCompletionQueue = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    items,
  };

  await writeJsonFile(QUEUE_PATH, queue);

  matrix.summary.queue_items_needed = items.filter((item) => item.collection_status === "needed").length;
  matrix.summary.shared_datasets_needed = items.filter(
    (item) => item.shared_source_id && item.collection_status === "needed",
  ).length;

  return queue;
}
