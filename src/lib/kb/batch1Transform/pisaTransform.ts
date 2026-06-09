import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { parseCsv } from "@/lib/sources/tabularParser";
import { repoPath } from "@/lib/pipeline/io";
import { mapToIso3 } from "@/lib/sources/countryCodeMapper";
import { getField } from "./rawFiles";
import { incrementSkip, MVP_COUNTRY_SET, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const PISA_SOURCE_URL = "https://www.oecd.org/pisa/";
const PISA_SOURCE_NAME = "OECD PISA";
const PISA_UNIT = "score";

const PISA_XLSX_FILES: Record<
  string,
  { sheetName: string; metricId: string; subjectLabel: string }
> = {
  "pisa_math.xlsx": {
    sheetName: "Table I.2.4",
    metricId: "pisa_math_score",
    subjectLabel: "mathematics",
  },
  "pisa_reading.xlsx": {
    sheetName: "Table I.2.5",
    metricId: "pisa_reading_score",
    subjectLabel: "reading",
  },
  "pisa_science.xlsx": {
    sheetName: "Table I.2.6",
    metricId: "pisa_science_score",
    subjectLabel: "science",
  },
};

const PISA_INDICATOR_TO_METRIC: Record<string, string> = {
  "student performance in maths (mean score)": "pisa_math_score",
  "student performance in mathematics (mean score)": "pisa_math_score",
  "student performance in reading (mean score)": "pisa_reading_score",
  "student performance in science (mean score)": "pisa_science_score",
};

const PISA_COUNTRY_ALIASES: Record<string, string> = {
  "UNITED STATES": "USA",
  TURKIYE: "TUR",
  TURKEY: "TUR",
  ISRAEL: "ISR",
  "SAUDI ARABIA": "SAU",
};

const CSV_SKIP_TERMS = [
  "gender",
  "rank",
  "percentile",
  "trend",
  "top performer",
  "low performer",
  "percentage",
  "percent",
  "%",
];

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeCountryLabel(value: string): string {
  return value
    .replace(/\*/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function buildRawRecordId(countryCode: string, year: string, metricId: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, metricId, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function isPisaMeanScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 200 && value <= 700;
}

function isNationalPisaRow(countryName: string): boolean {
  const trimmed = countryName.trim();
  if (!trimmed) {
    return false;
  }

  const lower = normalizeToken(trimmed);
  if (lower.includes(" region") || lower.includes("province") || lower.startsWith("oecd")) {
    return false;
  }
  if (trimmed.includes("(")) {
    return false;
  }

  return true;
}

function resolvePisaCountry(countryName: string): string | null {
  const normalized = normalizeCountryLabel(countryName);
  const aliased = PISA_COUNTRY_ALIASES[normalized];
  const iso3 = aliased ?? mapToIso3(normalized);
  if (!iso3 || !MVP_COUNTRY_SET.has(iso3)) {
    return null;
  }
  return iso3;
}

function extractPisaYear(workbook: XLSX.WorkBook, fallbackSheetName: string): string | null {
  const tocSheet = workbook.Sheets.TOC ?? workbook.Sheets[fallbackSheetName];
  if (!tocSheet) {
    return null;
  }

  const rows = XLSX.utils.sheet_to_json(tocSheet, { header: 1, defval: "" }) as unknown[][];
  for (const row of rows) {
    for (const cell of row) {
      const text = String(cell ?? "");
      const match = text.match(/PISA\s+(20\d{2})/i);
      if (match) {
        return match[1];
      }
    }
  }

  return null;
}

function parsePisaAnnexXlsx(
  filePath: string,
  config: (typeof PISA_XLSX_FILES)[string],
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow[] {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const year = extractPisaYear(workbook, config.sheetName);
  if (!year) {
    incrementSkip(skipReasons, "missing_date");
    return [];
  }

  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  const output: CanonicalMetricRow[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) {
      continue;
    }

    const countryName = String(row[0] ?? "").trim();
    const score = row[1];

    if (!isNationalPisaRow(countryName) || !isPisaMeanScore(score)) {
      if (countryName && isPisaMeanScore(score)) {
        incrementSkip(skipReasons, "non_mvp_country");
      }
      continue;
    }

    const countryCode = resolvePisaCountry(countryName);
    if (!countryCode) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }

    const value = String(Math.round(score * 100) / 100);
    output.push({
      country_code: countryCode,
      year,
      metric_id: config.metricId,
      value,
      unit: PISA_UNIT,
      source_url: PISA_SOURCE_URL,
      source_name: PISA_SOURCE_NAME,
      raw_record_id: buildRawRecordId(countryCode, year, config.metricId, value),
      calculation: "oecd_published_mean",
      notes: `${config.sheetName};pisa_subject=${config.subjectLabel}`,
    });
  }

  return output;
}

function shouldSkipCsvRow(record: ManualRecord): boolean {
  const blob = Object.values(record).join(" ").toLowerCase();
  return CSV_SKIP_TERMS.some((term) => blob.includes(term));
}

function resolveCsvMetricId(record: ManualRecord): string | null {
  const indicator = getField(record, [
    "indicator",
    "indicator_label",
    "subject",
    "measure",
    "variable",
    "description",
  ]);
  const normalized = normalizeToken(indicator);
  return PISA_INDICATOR_TO_METRIC[normalized] ?? null;
}

function resolveCsvCountry(record: ManualRecord): string | null {
  const countryRaw = getField(record, [
    "country_code",
    "country",
    "ref_area",
    "location",
    "country/economy",
    "country / economy",
  ]);
  if (!countryRaw) {
    return null;
  }

  const normalized = normalizeCountryLabel(countryRaw);
  const aliased = PISA_COUNTRY_ALIASES[normalized];
  const iso3 = aliased ?? mapToIso3(normalized) ?? resolveMvpCountry(countryRaw);
  return iso3 && MVP_COUNTRY_SET.has(iso3) ? iso3 : null;
}

function parsePisaIndicatorCsv(
  filePath: string,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow[] {
  const content = readFileSync(filePath, "utf8");
  const records = parseCsv(content);
  const output: CanonicalMetricRow[] = [];

  for (const record of records) {
    if (shouldSkipCsvRow(record)) {
      incrementSkip(skipReasons, "unmapped_metric_column");
      continue;
    }

    const metricId = resolveCsvMetricId(record);
    if (!metricId) {
      incrementSkip(skipReasons, "unmapped_metric_column");
      continue;
    }

    const countryCode = resolveCsvCountry(record);
    if (!countryCode) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }

    const year = getField(record, ["year", "time", "time_period", "cycle"]);
    if (!/^\d{4}$/.test(year)) {
      incrementSkip(skipReasons, "missing_date");
      continue;
    }

    const valueRaw = getField(record, ["value", "obs_value", "observation_value", "score", "mean"]);
    const valueNumeric = Number(valueRaw);
    if (!Number.isFinite(valueNumeric)) {
      incrementSkip(skipReasons, "empty_value");
      continue;
    }

    const value = String(Math.round(valueNumeric * 100) / 100);
    output.push({
      country_code: countryCode,
      year,
      metric_id: metricId,
      value,
      unit: PISA_UNIT,
      source_url: PISA_SOURCE_URL,
      source_name: PISA_SOURCE_NAME,
      raw_record_id: buildRawRecordId(countryCode, year, metricId, value),
      calculation: "oecd_published_mean",
      notes: "oecd_stat_indicator_export",
    });
  }

  return output;
}

function dedupeMetricRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  const byKey = new Map<string, CanonicalMetricRow>();
  for (const row of rows) {
    byKey.set(`${row.country_code}:${row.year}:${row.metric_id}`, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) {
      return country;
    }
    const year = a.year.localeCompare(b.year);
    if (year !== 0) {
      return year;
    }
    return a.metric_id.localeCompare(b.metric_id);
  });
}

export async function transformPisaFromRawFiles(
  rawFilePaths: string[],
  outputPath: string,
): Promise<{ rows: CanonicalMetricRow[]; stats: TransformStats }> {
  const skipReasons: TransformStats["skipReasons"] = {};
  const filesRead: string[] = [];
  const rows: CanonicalMetricRow[] = [];
  let rowsRead = 0;

  for (const filePath of rawFilePaths) {
    const fileName = path.basename(filePath).toLowerCase();
    const relativePath = path.relative(repoPath(), filePath).replace(/\\/g, "/");

    if (fileName.endsWith(".xlsx")) {
      const config = PISA_XLSX_FILES[fileName];
      if (!config) {
        incrementSkip(skipReasons, "unmapped_metric_column");
        continue;
      }

      const workbook = XLSX.readFile(filePath, { cellDates: false });
      const sheet = workbook.Sheets[config.sheetName];
      const sheetRows = sheet
        ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][])
        : [];
      rowsRead += sheetRows.length;
      filesRead.push(relativePath);
      rows.push(...parsePisaAnnexXlsx(filePath, config, skipReasons));
      continue;
    }

    if (fileName.endsWith(".csv")) {
      const content = readFileSync(filePath, "utf8");
      const records = parseCsv(content);
      rowsRead += records.length;
      filesRead.push(relativePath);
      rows.push(...parsePisaIndicatorCsv(filePath, skipReasons));
    }
  }

  const deduped = dedupeMetricRows(rows);
  const rowsSkipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "oecd_pisa",
      rawFilesRead: filesRead,
      rowsRead,
      rowsWritten: deduped.length,
      rowsSkipped,
      skipReasons,
      outputPath,
      implemented: true,
    },
  };
}
