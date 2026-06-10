import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ReplayComparisonGroup } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const COMPARISONS_DIR = repoPath("data", "forecasting", "comparisons");

function comparisonFilePath(comparisonGroupId: string): string {
  return path.join(COMPARISONS_DIR, comparisonGroupId, "comparison.v1.json");
}

export function createComparisonGroupId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `comparison_${stamp}_${suffix}`;
}

export async function saveComparisonGroup(group: ReplayComparisonGroup): Promise<void> {
  await writeJsonFile(comparisonFilePath(group.comparison_group_id), group);
}

export async function loadComparisonGroup(
  comparisonGroupId: string,
): Promise<ReplayComparisonGroup | null> {
  const filePath = comparisonFilePath(comparisonGroupId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ReplayComparisonGroup>(filePath);
}

export async function listComparisonGroups(): Promise<ReplayComparisonGroup[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(COMPARISONS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const groups: ReplayComparisonGroup[] = [];
  for (const id of entries) {
    const group = await loadComparisonGroup(id);
    if (group) {
      groups.push(group);
    }
  }
  return groups.sort((left, right) => right.created_at.localeCompare(left.created_at));
}
