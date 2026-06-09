import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { hasArchivedRawCopy, listRawImportFiles } from "@/lib/kb/batch1Transform/rawFiles";
import { BATCH1_TRANSFORM_SOURCES } from "@/lib/kb/batch1Transform/registry";
import type { TransformStats } from "@/lib/kb/batch1Transform/types";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import type {
  Batch1ManifestDataset,
  SourceReceiptEntry,
  SourceReceiptFile,
  TransformReceipt,
} from "@/types/sourceReceipt";

export const TRANSFORM_SCRIPT = "scripts/kb/transform_batch1_raw.ts";
export const TRANSFORM_VERSION = "1.0";

type Batch1Manifest = {
  datasets: Batch1ManifestDataset[];
};

export function receiptFilePath(sourceId: string): string {
  return repoPath("data", "source_receipts", sourceId + ".source_receipts.v1.json");
}

export function toRepoRelativePath(filePath: string): string {
  return path.relative(repoPath(), filePath).replace(/\\/g, "/");
}

export async function hashFile(filePath: string): Promise<{ sha256: string; sizeBytes: number }> {
  const buffer = await readFile(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const fileStat = await stat(filePath);
  return { sha256, sizeBytes: fileStat.size };
}

export function buildReceiptId(sourceId: string, sha256: string): string {
  return sourceId + ":" + sha256.slice(0, 16);
}

export function resolveGitCommit(): string | null {
  try {
    const commit = execSync("git rev-parse HEAD", {
      cwd: repoPath(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return commit || null;
  } catch {
    return null;
  }
}

export function resolveTransformVersion(): string {
  const commit = resolveGitCommit();
  return commit ? TRANSFORM_VERSION + "+" + commit.slice(0, 12) : TRANSFORM_VERSION;
}

let manifestCache: Map<string, Batch1ManifestDataset> | null = null;

export async function loadBatch1ManifestMetadata(
  sourceId: string,
): Promise<Batch1ManifestDataset | null> {
  if (!manifestCache) {
    const manifestPath = repoPath(
      "data",
      "source_requests",
      "batch_1_shared_datasets_manifest.v1.json",
    );
    if (!(await pathExists(manifestPath))) {
      manifestCache = new Map();
      return null;
    }
    const manifest = await readJsonFile<Batch1Manifest>(manifestPath);
    manifestCache = new Map(
      manifest.datasets.map((dataset) => [dataset.source_ingest_id, dataset]),
    );
  }
  return manifestCache.get(sourceId) ?? null;
}

export async function loadSourceReceipt(sourceId: string): Promise<SourceReceiptFile | null> {
  const filePath = receiptFilePath(sourceId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<SourceReceiptFile>(filePath);
}

export async function saveSourceReceipt(receipt: SourceReceiptFile): Promise<void> {
  await writeJsonFile(receiptFilePath(receipt.source_id), receipt);
}

function defaultMetadata(
  sourceId: string,
  manifest: Batch1ManifestDataset | null,
): Pick<
  SourceReceiptEntry,
  | "official_homepage"
  | "official_download_page"
  | "license_or_terms_note"
  | "source_org"
  | "source_title"
  | "collected_at"
  | "collected_by"
  | "notes"
> {
  return {
    collected_at: null,
    collected_by: null,
    official_homepage: manifest?.official_homepage ?? null,
    official_download_page:
      manifest?.official_download_page === "unknown_needs_manual_lookup"
        ? null
        : manifest?.official_download_page ?? null,
    license_or_terms_note: manifest?.license_or_terms_note ?? null,
    source_org: manifest?.source_org ?? null,
    source_title: manifest?.source_name ?? null,
    notes: null,
  };
}

export async function upsertRawReceiptEntries(
  sourceId: string,
  rawFilePaths: string[],
): Promise<SourceReceiptFile> {
  const manifest = await loadBatch1ManifestMetadata(sourceId);
  const existing = (await loadSourceReceipt(sourceId)) ?? {
    version: "1.0" as const,
    source_id: sourceId,
    last_updated: new Date().toISOString(),
    entries: [],
  };

  const byPath = new Map(existing.entries.map((entry) => [entry.raw_file_path, entry]));

  for (const rawFilePath of rawFilePaths) {
    const relativePath = toRepoRelativePath(rawFilePath);
    const { sha256, sizeBytes } = await hashFile(rawFilePath);
    const prior = byPath.get(relativePath);
    const metadata = prior
      ? {
          collected_at: prior.collected_at,
          collected_by: prior.collected_by,
          official_homepage: prior.official_homepage,
          official_download_page: prior.official_download_page,
          license_or_terms_note: prior.license_or_terms_note,
          source_org: prior.source_org,
          source_title: prior.source_title,
          notes: prior.notes,
        }
      : defaultMetadata(sourceId, manifest);

    const entry: SourceReceiptEntry = {
      receipt_id: buildReceiptId(sourceId, sha256),
      source_id: sourceId,
      raw_file_path: relativePath,
      raw_file_sha256: sha256,
      raw_file_size_bytes: sizeBytes,
      transforms: prior?.transforms ?? [],
      ...metadata,
    };

    byPath.set(relativePath, entry);
  }

  const receipt: SourceReceiptFile = {
    version: "1.0",
    source_id: sourceId,
    last_updated: new Date().toISOString(),
    entries: [...byPath.values()].sort((a, b) => a.raw_file_path.localeCompare(b.raw_file_path)),
  };

  await saveSourceReceipt(receipt);
  return receipt;
}

export async function appendTransformReceipt(input: {
  sourceId: string;
  rawFilePaths: string[];
  canonicalFilePath: string;
  stats: TransformStats;
}): Promise<SourceReceiptFile> {
  const relativeCanonical = toRepoRelativePath(input.canonicalFilePath);
  const { sha256 } = await hashFile(input.canonicalFilePath);

  const transform: TransformReceipt = {
    canonical_file_path: relativeCanonical,
    canonical_file_sha256: sha256,
    transform_script: TRANSFORM_SCRIPT,
    transform_version: resolveTransformVersion(),
    rows_read: input.stats.rowsRead,
    rows_written: input.stats.rowsWritten,
    rows_skipped: input.stats.rowsSkipped,
    skip_reasons: { ...input.stats.skipReasons },
    generated_at: new Date().toISOString(),
  };

  let receipt =
    (await loadSourceReceipt(input.sourceId)) ??
    (await upsertRawReceiptEntries(input.sourceId, input.rawFilePaths));

  const rawRelativePaths = new Set(input.rawFilePaths.map((filePath) => toRepoRelativePath(filePath)));
  const entryPaths = new Set(receipt.entries.map((entry) => entry.raw_file_path));

  for (const rawPath of rawRelativePaths) {
    if (!entryPaths.has(rawPath)) {
      receipt = await upsertRawReceiptEntries(input.sourceId, [
        repoPath(...rawPath.split("/")),
      ]);
    }
  }

  const activeRawPaths = new Set(
    (await listRawImportFiles(
      BATCH1_TRANSFORM_SOURCES.find((config) => config.sourceId === input.sourceId)?.rawFolder ??
        input.sourceId,
    )).map((filePath) => toRepoRelativePath(filePath)),
  );

  receipt.entries = receipt.entries
    .filter((entry) => activeRawPaths.has(entry.raw_file_path))
    .map((entry) => {
      if (!rawRelativePaths.has(entry.raw_file_path)) {
        return entry;
      }
      const withoutCanonical = entry.transforms.filter(
        (existing) => existing.canonical_file_path !== relativeCanonical,
      );
      return {
        ...entry,
        transforms: [...withoutCanonical, transform],
      };
    });
  receipt.last_updated = new Date().toISOString();

  await saveSourceReceipt(receipt);
  return receipt;
}

export async function listCanonicalImportFiles(
  sourceFolder: string,
  canonicalFilename: string,
): Promise<string[]> {
  const directory = repoPath("data", "manual_imports", sourceFolder);
  const filePath = path.join(directory, canonicalFilename);
  if (await pathExists(filePath)) {
    return [filePath];
  }
  return [];
}

export function entryMissingMetadata(entry: SourceReceiptEntry): string[] {
  const missing: string[] = [];
  if (!entry.official_homepage) missing.push("official_homepage");
  if (!entry.official_download_page) missing.push("official_download_page");
  if (!entry.license_or_terms_note) missing.push("license_or_terms_note");
  return missing;
}

export async function auditSourceReceipts(): Promise<{
  rawWithoutReceipts: Array<{ sourceId: string; rawFilePath: string }>;
  canonicalWithoutReceipts: Array<{ sourceId: string; canonicalFilePath: string }>;
  missingMetadata: Array<{ sourceId: string; receiptId: string; fields: string[] }>;
  sha256Mismatches: Array<{ sourceId: string; filePath: string; kind: "raw" | "canonical" }>;
}> {
  const rawWithoutReceipts: Array<{ sourceId: string; rawFilePath: string }> = [];
  const canonicalWithoutReceipts: Array<{ sourceId: string; canonicalFilePath: string }> = [];
  const missingMetadata: Array<{ sourceId: string; receiptId: string; fields: string[] }> = [];
  const sha256Mismatches: Array<{ sourceId: string; filePath: string; kind: "raw" | "canonical" }> =
    [];

  for (const config of BATCH1_TRANSFORM_SOURCES) {
    const sourceId = config.sourceId;
    const rawFiles = await listRawImportFiles(config.rawFolder);
    const canonicalFiles = await listCanonicalImportFiles(
      config.canonicalFolder,
      config.canonicalFilename,
    );
    const receipt = await loadSourceReceipt(sourceId);

    const receiptRawPaths = new Set(
      (receipt?.entries ?? []).map((entry) => entry.raw_file_path),
    );
    const receiptCanonicalPaths = new Set(
      (receipt?.entries ?? []).flatMap((entry) =>
        entry.transforms.map((transform) => transform.canonical_file_path),
      ),
    );

    for (const rawFile of rawFiles) {
      const relative = toRepoRelativePath(rawFile);
      if (!receiptRawPaths.has(relative)) {
        rawWithoutReceipts.push({ sourceId, rawFilePath: relative });
      }
    }

    for (const canonicalFile of canonicalFiles) {
      const relative = toRepoRelativePath(canonicalFile);
      if (!receiptCanonicalPaths.has(relative)) {
        canonicalWithoutReceipts.push({ sourceId, canonicalFilePath: relative });
      }
    }

    const activeRawPathSet = new Set(rawFiles.map((filePath) => toRepoRelativePath(filePath)));
    const latestCanonicalTransforms = new Map<string, TransformReceipt>();

    for (const entry of receipt?.entries ?? []) {
      const missing = entryMissingMetadata(entry);
      if (missing.length > 0) {
        missingMetadata.push({ sourceId, receiptId: entry.receipt_id, fields: missing });
      }

      const rawFileName = path.basename(entry.raw_file_path);
      const rawFolder = path.posix.dirname(entry.raw_file_path).split("/").pop() ?? "";
      const rawArchived = await hasArchivedRawCopy(rawFolder, rawFileName);

      if (activeRawPathSet.has(entry.raw_file_path) && !rawArchived) {
        const rawAbsolute = repoPath(...entry.raw_file_path.split("/"));
        if (await pathExists(rawAbsolute)) {
          const { sha256 } = await hashFile(rawAbsolute);
          if (sha256 !== entry.raw_file_sha256) {
            sha256Mismatches.push({ sourceId, filePath: entry.raw_file_path, kind: "raw" });
          }
        }
      }

      for (const transform of entry.transforms) {
        const existing = latestCanonicalTransforms.get(transform.canonical_file_path);
        if (!existing || transform.generated_at > existing.generated_at) {
          latestCanonicalTransforms.set(transform.canonical_file_path, transform);
        }
      }
    }

    for (const transform of latestCanonicalTransforms.values()) {
      const canonicalAbsolute = repoPath(...transform.canonical_file_path.split("/"));
      if (await pathExists(canonicalAbsolute)) {
        const { sha256 } = await hashFile(canonicalAbsolute);
        if (sha256 !== transform.canonical_file_sha256) {
          sha256Mismatches.push({
            sourceId,
            filePath: transform.canonical_file_path,
            kind: "canonical",
          });
        }
      }
    }
  }

  return {
    rawWithoutReceipts,
    canonicalWithoutReceipts,
    missingMetadata,
    sha256Mismatches,
  };
}
