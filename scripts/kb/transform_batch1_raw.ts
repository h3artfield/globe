import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getImportValidateCliArgs, parseImportValidateArgs } from "@/lib/kb/importValidateArgs";
import {
  BATCH1_TRANSFORM_SOURCES,
  runSourceTransform,
  STUB_TRANSFORM_MESSAGE,
} from "@/lib/kb/batch1Transform/registry";
import { recordsToCsv } from "@/lib/kb/batch1Transform/csvWriter";
import { listRawImportFiles, readRawRecords } from "@/lib/kb/batch1Transform/rawFiles";
import { readWipoRawRecords } from "@/lib/kb/batch1Transform/wipoTransform";
import { transformPisaFromRawFiles } from "@/lib/kb/batch1Transform/pisaTransform";
import { transformWvsFromRawFiles, WVS_CANONICAL_HEADERS } from "@/lib/kb/batch1Transform/wvsTransform";
import { METRIC_CANONICAL_HEADERS, type TransformStats } from "@/lib/kb/batch1Transform/types";
import { appendTransformReceipt, upsertRawReceiptEntries } from "@/lib/kb/sourceReceipts";
import { repoPath } from "@/lib/pipeline/io";

function printStats(stats: TransformStats): void {
  const status = stats.error ? "FAIL" : stats.rowsWritten > 0 ? "PASS" : "EMPTY";
  console.log("");
  console.log("[" + status + "] " + stats.sourceId);
  if (stats.rawFilesRead.length > 0) {
    console.log("  raw files: " + stats.rawFilesRead.join(", "));
  } else {
    console.log("  raw files: (none)");
  }
  console.log("  rows read: " + stats.rowsRead);
  console.log("  rows written: " + stats.rowsWritten);
  console.log("  rows skipped: " + stats.rowsSkipped);
  if (Object.keys(stats.skipReasons).length > 0) {
    console.log("  skip reasons:");
    for (const [reason, count] of Object.entries(stats.skipReasons)) {
      console.log("    " + reason + ": " + count);
    }
  }
  if (stats.rowsWritten > 0) {
    console.log("  output: " + path.relative(repoPath(), stats.outputPath).replace(/\\/g, "/"));
  }
  if (stats.error) {
    console.log("  error: " + stats.error);
  }
}

async function transformSource(config: (typeof BATCH1_TRANSFORM_SOURCES)[number]): Promise<TransformStats> {
  const outputPath = repoPath(
    "data",
    "manual_imports",
    config.canonicalFolder,
    config.canonicalFilename,
  );
  const rawFiles = await listRawImportFiles(config.rawFolder);

  if (rawFiles.length === 0) {
    return {
      sourceId: config.sourceId,
      rawFilesRead: [],
      rowsRead: 0,
      rowsWritten: 0,
      rowsSkipped: 0,
      skipReasons: {},
      outputPath,
      implemented: config.implemented,
      error: config.implemented
        ? "No raw files found in data/manual_imports_raw/" + config.rawFolder + "/"
        : STUB_TRANSFORM_MESSAGE,
    };
  }

  await upsertRawReceiptEntries(config.sourceId, rawFiles);

  const observationFiles =
    config.rawObservationFiles && config.rawObservationFiles.length > 0
      ? rawFiles.filter((filePath) => config.rawObservationFiles!.includes(path.basename(filePath)))
      : rawFiles;

  if (config.sourceId === "oecd_pisa") {
    const { rows, stats } = await transformPisaFromRawFiles(observationFiles, outputPath);
    if (rows.length === 0) {
      return {
        ...stats,
        error: "Transform produced zero canonical rows from raw input.",
      };
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      recordsToCsv(
        METRIC_CANONICAL_HEADERS,
        rows as Array<Record<string, string>>,
      ),
      "utf8",
    );

    await appendTransformReceipt({
      sourceId: config.sourceId,
      rawFilePaths: rawFiles,
      canonicalFilePath: outputPath,
      stats,
    });

    return stats;
  }

  if (config.sourceId === "world_values_survey") {
    const { rows, stats } = await transformWvsFromRawFiles(observationFiles, outputPath);
    if (rows.length === 0) {
      return {
        ...stats,
        error: "Transform produced zero canonical rows from raw input.",
      };
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      recordsToCsv(WVS_CANONICAL_HEADERS, rows as Array<Record<string, string>>),
      "utf8",
    );

    await appendTransformReceipt({
      sourceId: config.sourceId,
      rawFilePaths: rawFiles,
      canonicalFilePath: outputPath,
      stats,
    });

    return stats;
  }

  const { records, filesRead } =
    config.sourceId === "wipo"
      ? await readWipoRawRecords(observationFiles)
      : await readRawRecords(observationFiles);
  const { output, stats } = runSourceTransform(config, records, filesRead, outputPath);

  if (!config.implemented || !output) {
    return stats;
  }

  if (output.rows.length === 0) {
    return {
      ...stats,
      error: "Transform produced zero canonical rows from raw input.",
    };
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    recordsToCsv(
      output.headers,
      output.rows as Array<Record<string, string>>,
    ),
    "utf8",
  );

  await appendTransformReceipt({
    sourceId: config.sourceId,
    rawFilePaths: rawFiles,
    canonicalFilePath: outputPath,
    stats,
  });

  return stats;
}

function parseTransformSources(argv: string[]): string[] {
  const parsed = parseImportValidateArgs(argv);
  if (parsed.sources.length > 0) {
    return parsed.sources;
  }

  const knownSources = new Set(BATCH1_TRANSFORM_SOURCES.map((config) => config.sourceId));
  return argv
    .filter((arg) => !arg.startsWith("--") && knownSources.has(arg.trim().toLowerCase()))
    .map((arg) => arg.trim().toLowerCase());
}

async function main() {
  const cliArgs = getImportValidateCliArgs();
  const sourceFilter = parseTransformSources(cliArgs);
  const sources =
    sourceFilter.length > 0
      ? BATCH1_TRANSFORM_SOURCES.filter((config) => sourceFilter.includes(config.sourceId))
      : [...BATCH1_TRANSFORM_SOURCES];

  if (sources.length === 0) {
    console.error("No matching Batch 1 sources for transform.");
    process.exit(1);
  }

  console.log("Batch 1 Raw → Canonical Transform");
  console.log("================================");
  if (sourceFilter.length > 0) {
    console.log("Source filter: " + sourceFilter.join(", "));
  }

  const results = await Promise.all(sources.map((config) => transformSource(config)));

  for (const stats of results) {
    printStats(stats);
  }

  const implementedWrites = results.filter((stats) => stats.implemented && stats.rowsWritten > 0).length;
  const stubFailures = results.filter((stats) => !stats.implemented || stats.error === STUB_TRANSFORM_MESSAGE);
  const hardFailures = results.filter(
    (stats) => stats.error && stats.error !== STUB_TRANSFORM_MESSAGE && stats.rowsWritten === 0,
  );

  console.log("");
  console.log(
    "Summary: " +
      implementedWrites +
      "/" +
      results.length +
      " sources wrote canonical output",
  );

  if (stubFailures.length > 0) {
    console.log(
      "Placeholders: " + stubFailures.map((stats) => stats.sourceId).join(", "),
    );
  }

  if (hardFailures.length > 0 && implementedWrites === 0) {
    process.exit(1);
  }

  if (sourceFilter.length > 0 && stubFailures.some((stats) => sourceFilter.includes(stats.sourceId))) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
