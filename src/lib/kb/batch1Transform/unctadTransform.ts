import { createHash } from "node:crypto";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const UNCTAD_SOURCE_URL = "https://unctadstat.unctad.org/";
const UNCTAD_SOURCE_NAME = "UNCTAD";

const LSCI_METRIC_ID = "liner_shipping_connectivity_index";
const LSCI_UNIT = "index";
const TRADE_OPENNESS_METRIC_ID = "trade_openness";
const TRADE_OPENNESS_UNIT = "percent_gdp";
const TRADE_OPENNESS_SERIES_CODE = "2106";
const TRADE_OPENNESS_SERIES_LABEL = "total trade in goods and services";
const TRADE_OPENNESS_FLOW_CODE = "21";
const TRADE_OPENNESS_FLOW_LABEL = "sum of imports and exports";

const UNCTAD_M49_TO_ISO3: Record<string, string> = {
  "156": "CHN",
  "231": "ETH",
  "356": "IND",
  "364": "IRN",
  "376": "ISR",
  "586": "PAK",
  "643": "RUS",
  "682": "SAU",
  "792": "TUR",
  "804": "UKR",
  "818": "EGY",
  "840": "USA",
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function isNumericObservation(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function buildRawRecordId(countryCode: string, year: string, metricId: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, metricId, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function resolveUnctadCountry(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): string | null {
  const economyCode = getField(record, ["economy"]).trim();
  const economyLabel = getField(record, ["economy_label", "economy label"]);

  const mappedFromCode = UNCTAD_M49_TO_ISO3[economyCode];
  if (mappedFromCode) {
    return mappedFromCode;
  }

  if (!economyLabel) {
    incrementSkip(skipReasons, "missing_country");
    return null;
  }

  const cleanedLabel = economyLabel.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const countryCode = resolveMvpCountry(cleanedLabel) ?? resolveMvpCountry(economyLabel);
  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  return countryCode;
}

function parseQuarterToken(quarter: string): { year: string; quarter: number } | null {
  const match = /^(\d{4})Q(\d{2})$/i.exec(quarter.trim());
  if (!match) {
    return null;
  }
  return { year: match[1], quarter: Number(match[2]) };
}

function parseLsciRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): { countryCode: string; year: string; quarter: number; value: string } | null {
  const countryCode = resolveUnctadCountry(record, skipReasons);
  if (!countryCode) {
    return null;
  }

  const quarterToken = getField(record, ["quarter"]);
  const parsedQuarter = parseQuarterToken(quarterToken);
  if (!parsedQuarter) {
    incrementSkip(skipReasons, "missing_required_field");
    return null;
  }

  const missingValue = getField(record, [
    "index_(average_q1_2023_=_100)_missing_value",
    "index (average q1 2023 = 100) missing value",
  ]);
  if (normalizeToken(missingValue) === "not applicable") {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  const value = getField(record, [
    "index_(average_q1_2023_=_100)",
    "index (average q1 2023 = 100)",
  ]);
  if (!isNumericObservation(value)) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  return {
    countryCode,
    year: parsedQuarter.year,
    quarter: parsedQuarter.quarter,
    value,
  };
}

function collapseLsciRows(
  records: ManualRecord[],
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow[] {
  const byCountryYear = new Map<string, { quarter: number; value: string; countryCode: string; year: string }>();

  for (const record of records) {
    const parsed = parseLsciRow(record, skipReasons);
    if (!parsed) {
      continue;
    }

    const key = `${parsed.countryCode}:${parsed.year}`;
    const existing = byCountryYear.get(key);
    if (!existing || parsed.quarter > existing.quarter) {
      byCountryYear.set(key, parsed);
    }
  }

  return [...byCountryYear.values()].map((entry) => ({
    country_code: entry.countryCode,
    year: entry.year,
    metric_id: LSCI_METRIC_ID,
    value: entry.value,
    unit: LSCI_UNIT,
    source_url: UNCTAD_SOURCE_URL,
    source_name: UNCTAD_SOURCE_NAME,
    raw_record_id: buildRawRecordId(entry.countryCode, entry.year, LSCI_METRIC_ID, entry.value),
    calculation: "",
    notes: "unctad_table=US.LSCI",
  }));
}

function parseTradeOpennessRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow | null {
  const seriesCode = getField(record, ["series"]).trim();
  const seriesLabel = normalizeToken(getField(record, ["series_label", "series label"]));
  if (seriesCode !== TRADE_OPENNESS_SERIES_CODE && seriesLabel !== TRADE_OPENNESS_SERIES_LABEL) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const flowCode = getField(record, ["flow"]).trim();
  const flowLabel = normalizeToken(getField(record, ["flow_label", "flow label"]));
  if (flowCode !== TRADE_OPENNESS_FLOW_CODE && flowLabel !== TRADE_OPENNESS_FLOW_LABEL) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const countryCode = resolveUnctadCountry(record, skipReasons);
  if (!countryCode) {
    return null;
  }

  const year = getField(record, ["year"]);
  if (!year || !/^\d{4}$/.test(year)) {
    incrementSkip(skipReasons, "missing_required_field");
    return null;
  }

  const missingValue = getField(record, [
    "percentage_of_gross_domestic_product_missing_value",
    "percentage of gross domestic product missing value",
  ]);
  if (normalizeToken(missingValue) === "not applicable") {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  const value = getField(record, [
    "percentage_of_gross_domestic_product",
    "percentage of gross domestic product",
  ]);
  if (!isNumericObservation(value)) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  return {
    country_code: countryCode,
    year,
    metric_id: TRADE_OPENNESS_METRIC_ID,
    value,
    unit: TRADE_OPENNESS_UNIT,
    source_url: UNCTAD_SOURCE_URL,
    source_name: UNCTAD_SOURCE_NAME,
    raw_record_id: buildRawRecordId(countryCode, year, TRADE_OPENNESS_METRIC_ID, value),
    calculation: "",
    notes: "unctad_series=2106;unctad_flow=21",
  };
}

function dedupeMetricRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  const byKey = new Map<string, CanonicalMetricRow>();
  for (const row of rows) {
    byKey.set(`${row.country_code}:${row.year}:${row.metric_id}`, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) return country;
    const year = a.year.localeCompare(b.year);
    if (year !== 0) return year;
    return a.metric_id.localeCompare(b.metric_id);
  });
}

function isLsciRecord(record: ManualRecord): boolean {
  return Boolean(getField(record, ["quarter"]));
}

export function transformUnctad(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const lsciRecords = records.filter(isLsciRecord);
  const tradeOpennessRecords = records.filter((record) => !isLsciRecord(record));

  const rows = [
    ...collapseLsciRows(lsciRecords, skipReasons),
    ...tradeOpennessRecords
      .map((record) => parseTradeOpennessRow(record, skipReasons))
      .filter((row): row is CanonicalMetricRow => row !== null),
  ];

  const deduped = dedupeMetricRows(rows);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "unctad",
      rawFilesRead,
      rowsRead: records.length,
      rowsWritten: deduped.length,
      rowsSkipped: skipped,
      skipReasons,
      outputPath,
      implemented: true,
    },
  };
}
