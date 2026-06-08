import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  getImportValidateCliArgs,
  parseImportValidateArgs,
  resolveExitCode,
} from "@/lib/kb/importValidateArgs";
import { repoPath } from "@/lib/pipeline/io";
import {
  EVENT_REQUIRED_FIELDS,
  findEventField,
  isExampleEventRow,
  parseConfidenceLevel,
  parseCountryCodes,
  parseEventDate,
} from "@/lib/sources/eventRecordParser";
import { parseManualFile, type ManualRecord } from "@/lib/sources/tabularParser";

const EVENT_DATASETS = [
  {
    sourceId: "acled",
    folder: "acled",
    suggestedFilename: "acled_events.csv",
    template: "acled_events.template.csv",
  },
  {
    sourceId: "ucdp",
    folder: "ucdp",
    suggestedFilename: "ucdp_conflict.csv",
    template: "ucdp_conflict.template.csv",
  },
  {
    sourceId: "correlates_of_war",
    folder: "correlates_of_war",
    suggestedFilename: "cow_alliances_wars.csv",
    template: "cow_alliances_wars.template.csv",
  },
] as const;

type DatasetResult = {
  sourceId: string;
  folder: string;
  passed: boolean;
  filesChecked: string[];
  rowsChecked: number;
  errors: string[];
  warnings: string[];
};

function hasRequiredEventColumns(headers: string[]): string[] {
  const headerSet = new Set(headers);
  return EVENT_REQUIRED_FIELDS.filter((field) => !headerSet.has(field));
}

function isValidConfidence(raw: string): boolean {
  if (!raw) return true;
  const lower = raw.toLowerCase();
  if (["high", "medium", "low", "unknown"].includes(lower)) return true;
  return Number.isFinite(Number(raw));
}

async function listImportFiles(folder: string): Promise<string[]> {
  const directory = repoPath("data", "manual_imports", folder);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        [".csv", ".json", ".jsonl"].includes(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function validateEventRow(record: ManualRecord, fileName: string, rowNumber: number): string[] {
  const errors: string[] = [];
  const eventDate = findEventField(record, ["event_date"]);
  const countryCodesRaw = findEventField(record, ["country_codes"]);
  const sourceUrl = findEventField(record, ["source_url"]);
  const confidence = findEventField(record, ["confidence"]);

  if (!parseEventDate(eventDate)) {
    errors.push(fileName + ":" + rowNumber + ": event_date must parse as a date");
  }

  const countryCodes = parseCountryCodes(countryCodesRaw);
  if (!countryCodes.length) {
    errors.push(
      fileName + ":" + rowNumber + ": country_codes must contain one or more MVP ISO3 country codes",
    );
  }

  if (!sourceUrl) {
    errors.push(fileName + ":" + rowNumber + ": source_url is required for source-backed events");
  }

  if (confidence && !isValidConfidence(confidence)) {
    errors.push(fileName + ":" + rowNumber + ": confidence must be numeric or high|medium|low|unknown");
  } else if (confidence) {
    parseConfidenceLevel(confidence);
  }

  return errors;
}

async function validateDataset(dataset: (typeof EVENT_DATASETS)[number]): Promise<DatasetResult> {
  const result: DatasetResult = {
    sourceId: dataset.sourceId,
    folder: dataset.folder,
    passed: true,
    filesChecked: [],
    rowsChecked: 0,
    errors: [],
    warnings: [],
  };

  const files = await listImportFiles(dataset.folder);
  if (files.length === 0) {
    result.passed = false;
    result.errors.push(
      "No import files found in data/manual_imports/" +
        dataset.folder +
        "/ (expected e.g. " +
        dataset.suggestedFilename +
        ")",
    );
    result.warnings.push("Template available at data/manual_imports/_templates/" + dataset.template);
    return result;
  }

  for (const filePath of files) {
    result.filesChecked.push(path.relative(repoPath(), filePath).replace(/\\/g, "/"));
    const records = await parseManualFile(filePath);
    if (records.length === 0) {
      result.passed = false;
      result.errors.push(path.basename(filePath) + ": file is empty or unparsable");
      continue;
    }

    const missingColumns = hasRequiredEventColumns(Object.keys(records[0]));
    if (missingColumns.length > 0) {
      result.passed = false;
      result.errors.push(
        path.basename(filePath) + ": missing required columns: " + missingColumns.join(", "),
      );
    }

    for (const [index, record] of records.entries()) {
      if (isExampleEventRow(record)) {
        result.warnings.push(path.basename(filePath) + ":" + (index + 2) + ": skipped EXAMPLE_ONLY row");
        continue;
      }

      result.rowsChecked += 1;
      const rowErrors = validateEventRow(record, path.basename(filePath), index + 2);
      if (rowErrors.length > 0) {
        result.passed = false;
        result.errors.push(...rowErrors);
      }
    }

    if (result.rowsChecked === 0) {
      result.passed = false;
      result.errors.push(
        path.basename(filePath) + ": no ingestible rows (file empty or EXAMPLE_ONLY rows only)",
      );
    }
  }

  return result;
}

async function main() {
  const args = parseImportValidateArgs(getImportValidateCliArgs());
  const datasets =
    args.sources.length > 0
      ? EVENT_DATASETS.filter((dataset) => args.sources.includes(dataset.sourceId))
      : [...EVENT_DATASETS];

  if (datasets.length === 0) {
    console.error("No matching event sources. Use --source acled|ucdp|correlates_of_war");
    process.exit(1);
  }

  console.log("KB Event Import Preflight");
  console.log("=========================");
  if (args.strict) {
    console.log("Mode: strict (all selected datasets must pass)");
  } else {
    console.log("Mode: default (exit 0 if at least one dataset passes; fail on schema errors in present files)");
  }
  if (args.sources.length > 0) {
    console.log("Source filter: " + args.sources.join(", "));
  }

  const results = await Promise.all(datasets.map((dataset) => validateDataset(dataset)));
  const passCount = results.filter((result) => result.passed).length;

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log("");
    console.log("[" + status + "] " + result.sourceId + " (data/manual_imports/" + result.folder + "/)");
    if (result.filesChecked.length > 0) {
      console.log("  files: " + result.filesChecked.join(", "));
      console.log("  rows validated: " + result.rowsChecked);
    }
    for (const warning of result.warnings) {
      console.log("  warning: " + warning);
    }
    for (const error of result.errors) {
      console.log("  error: " + error);
    }
  }

  console.log("");
  console.log("Summary: " + passCount + "/" + results.length + " event datasets passed");
  process.exit(resolveExitCode({ strict: args.strict, results }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
