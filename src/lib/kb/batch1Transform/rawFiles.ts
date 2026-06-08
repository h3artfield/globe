import { readdir } from "node:fs/promises";
import path from "node:path";
import { repoPath } from "@/lib/pipeline/io";
import { parseManualFile, type ManualRecord } from "@/lib/sources/tabularParser";

const IMPORT_EXTENSIONS = new Set([".csv", ".json", ".jsonl"]);

export async function listRawImportFiles(sourceFolder: string): Promise<string[]> {
  const directory = repoPath("data", "manual_imports_raw", sourceFolder);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        IMPORT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
        !entry.name.toLowerCase().includes("readme"),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

export async function readRawRecords(files: string[]): Promise<{ records: ManualRecord[]; filesRead: string[] }> {
  const records: ManualRecord[] = [];
  const filesRead: string[] = [];

  for (const filePath of files) {
    const parsed = await parseManualFile(filePath);
    if (parsed.length > 0) {
      filesRead.push(path.relative(repoPath(), filePath).replace(/\\/g, "/"));
      records.push(...parsed);
    }
  }

  return { records, filesRead };
}

export function normalizeHeaderName(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

export function getField(record: ManualRecord, names: readonly string[]): string {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [
    normalizeHeaderName(key),
    value,
  ]) as Array<[string, string]>;

  for (const name of names) {
    const normalizedName = normalizeHeaderName(name);
    const match = normalizedEntries.find(([key]) => key === normalizedName);
    if (match && match[1] !== undefined && String(match[1]).trim() !== "") {
      return String(match[1]).trim();
    }
  }

  return "";
}
