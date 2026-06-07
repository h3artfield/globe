import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { SourceConfig } from "@/types/pipeline";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

const IMPORT_EXTENSIONS = new Set([".csv", ".json", ".jsonl"]);

function workspaceRelativeToFsPath(pathname: string): string {
  if (pathname.startsWith("/data/")) {
    return repoPath(pathname.slice(1));
  }

  return path.isAbsolute(pathname) ? pathname : repoPath(pathname);
}

export async function findManualImportFiles(config: SourceConfig): Promise<string[]> {
  const importDirectory = workspaceRelativeToFsPath(config.manual_import_dir);

  try {
    const entries = await readdir(importDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMPORT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(importDirectory, entry.name))
      .sort();
  } catch {
    return [];
  }
}

export async function archiveManualImportFiles(
  config: SourceConfig,
  files: string[],
  date = new Date().toISOString().slice(0, 10),
): Promise<{ rawDirectory: string; archivedFiles: string[] }> {
  const rawDirectory = workspaceRelativeToFsPath(path.join(config.raw_output_dir, date));
  await mkdir(rawDirectory, { recursive: true });

  if (files.length === 0) {
    await writeJsonFile(path.join(rawDirectory, "NO_MANUAL_FILES.json"), {
      source_id: config.source_id,
      archived_at: new Date().toISOString(),
      status: "no_manual_files",
      message: "No manual import files were present; no metrics emitted.",
    });
    return { rawDirectory, archivedFiles: [] };
  }

  const archivedFiles: string[] = [];

  for (const file of files) {
    const destination = path.join(rawDirectory, path.basename(file));
    await copyFile(file, destination);
    archivedFiles.push(destination);
  }

  return { rawDirectory, archivedFiles };
}

export function toPublicDataPath(filePath: string): string {
  const relative = path.relative(repoPath(), filePath);
  return `/${relative.split(path.sep).join("/")}`;
}
