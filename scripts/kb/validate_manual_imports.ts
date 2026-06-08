import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  getImportValidateCliArgs,
  parseImportValidateArgs,
  resolveExitCode,
} from "@/lib/kb/importValidateArgs";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { repoPath } from "@/lib/pipeline/io";
import { mapToIso3 } from "@/lib/sources/countryCodeMapper";
import { getSourceMetricDefinition } from "@/lib/sources/sourceMetricDefinitions";
import { parseManualFile, type ManualRecord } from "@/lib/sources/tabularParser";

const ALLOWED_COUNTRIES = new Set<string>([...MVP_COUNTRIES, "WLD"]);

const COUNTRY_FIELDS = ["country_code", "country_iso3", "iso3", "refArea", "country"] as const;
const METRIC_FIELDS = ["metric_id", "indicator", "indicator_id"] as const;
const VALUE_FIELDS = ["value", "obs_value", "metric_value"] as const;
const RECOMMENDED_FIELDS = ["year", "unit", "source_url", "source_name", "raw_record_id", "notes"] as const;

const BATCH1_DATASETS = [
  {
    sourceId: "vdem",
    folder: "vdem",
    suggestedFilename: "vdem_country_year.csv",
    template: "vdem_country_year.template.csv",
  },
  {
    sourceId: "un_comtrade",
    folder: "un_comtrade",
    suggestedFilename: "un_comtrade_bilateral.csv",
    template: "un_comtrade_bilateral.template.csv",
    allowWorld: true,
  },
  {
    sourceId: "unodc",
    folder: "unodc",
    suggestedFilename: "unodc_crime.csv",
    template: "unodc_crime.template.csv",
  },
  {
    sourceId: "unesco_uis",
    folder: "unesco_uis",
    suggestedFilename: "unesco_uis_education.csv",
    template: "unesco_uis_education.template.csv",
  },
  {
    sourceId: "wipo",
    folder: "wipo",
    suggestedFilename: "wipo_patents.csv",
    template: "wipo_patents.template.csv",
  },
  {
    sourceId: "world_values_survey",
    folder: "world_values_survey",
    suggestedFilename: "wvs_country_crosstabs.csv",
    template: "wvs_country_crosstabs.template.csv",
  },
  {
    sourceId: "oecd_pisa",
    folder: "oecd_pisa",
    suggestedFilename: "oecd_pisa_scores.csv",
    template: "oecd_pisa_scores.template.csv",
  },
  {
    sourceId: "unctad",
    folder: "unctad",
    suggestedFilename: "unctad_trade_maritime.csv",
    template: "unctad_trade_maritime.template.csv",
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

function findField(record: ManualRecord, names: readonly string[]): string {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== "") {
      return String(record[name]).trim();
    }
  }
  return "";
}

function isExampleRow(record: ManualRecord): boolean {
  const notes = findField(record, ["notes"]).toUpperCase();
  return notes.includes("EXAMPLE_ONLY");
}

function hasRequiredColumns(headers: string[]): string[] {
  const missing: string[] = [];
  const headerSet = new Set(headers);
  const hasCountry = COUNTRY_FIELDS.some((field) => headerSet.has(field));
  const hasMetric = METRIC_FIELDS.some((field) => headerSet.has(field));
  const hasValue = VALUE_FIELDS.some((field) => headerSet.has(field));
  if (!hasCountry) missing.push("country field (country_code|country_iso3|iso3|refArea|country)");
  if (!hasMetric) missing.push("metric field (metric_id|indicator|indicator_id)");
  if (!hasValue) missing.push("value field (value|obs_value|metric_value)");
  return missing;
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

async function validateDataset(dataset: (typeof BATCH1_DATASETS)[number]): Promise<DatasetResult> {
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

    const headers = Object.keys(records[0]);
    const missingColumns = hasRequiredColumns(headers);
    if (missingColumns.length > 0) {
      result.passed = false;
      result.errors.push(path.basename(filePath) + ": missing required columns: " + missingColumns.join(", "));
    }

    const missingRecommended = RECOMMENDED_FIELDS.filter((field) => !headers.includes(field));
    if (missingRecommended.length > 0) {
      result.warnings.push(
        path.basename(filePath) + ": missing recommended columns: " + missingRecommended.join(", "),
      );
    }

    for (const [index, record] of records.entries()) {
      if (isExampleRow(record)) {
        result.warnings.push(path.basename(filePath) + ":" + (index + 2) + ": skipped EXAMPLE_ONLY row");
        continue;
      }

      result.rowsChecked += 1;
      const countryRaw = findField(record, COUNTRY_FIELDS);
      const metricId = findField(record, METRIC_FIELDS);
      const value = findField(record, VALUE_FIELDS);
      const countryCode = countryRaw ? mapToIso3(countryRaw) : null;

      if (!countryRaw) {
        result.passed = false;
        result.errors.push(path.basename(filePath) + ":" + (index + 2) + ": missing country code");
        continue;
      }
      if (!countryCode || !ALLOWED_COUNTRIES.has(countryCode)) {
        result.passed = false;
        result.errors.push(
          path.basename(filePath) + ":" + (index + 2) + ": invalid country code '" + countryRaw + "'",
        );
      } else if (countryCode === "WLD" && dataset.sourceId !== "un_comtrade") {
        result.passed = false;
        result.errors.push(
          path.basename(filePath) + ":" + (index + 2) + ": WLD only allowed for un_comtrade",
        );
      }

      if (!metricId) {
        result.passed = false;
        result.errors.push(path.basename(filePath) + ":" + (index + 2) + ": missing metric_id");
        continue;
      }
      if (!getSourceMetricDefinition(dataset.sourceId, metricId)) {
        result.passed = false;
        result.errors.push(
          path.basename(filePath) +
            ":" +
            (index + 2) +
            ": unknown metric_id '" +
            metricId +
            "' for source " +
            dataset.sourceId,
        );
      }

      if (!value) {
        result.warnings.push(path.basename(filePath) + ":" + (index + 2) + ": empty value (allowed as null metric)");
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
      ? BATCH1_DATASETS.filter((dataset) => args.sources.includes(dataset.sourceId))
      : [...BATCH1_DATASETS];

  if (datasets.length === 0) {
    console.error(
      "No matching metric sources. Use --source vdem|un_comtrade|unodc|unesco_uis|wipo|world_values_survey|oecd_pisa|unctad",
    );
    process.exit(1);
  }

  console.log("KB Manual Import Preflight");
  console.log("==========================");
  if (args.strict) {
    console.log("Mode: strict (all selected datasets must pass)");
  } else {
    console.log(
      "Mode: default (exit 0 if at least one dataset passes; fail on schema errors in present files)",
    );
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
  console.log("Summary: " + passCount + "/" + results.length + " datasets passed");
  if (passCount < results.length) {
    console.log("Copy templates from data/manual_imports/_templates/ and add real exports before ingest.");
  }
  process.exit(resolveExitCode({ strict: args.strict, results }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
