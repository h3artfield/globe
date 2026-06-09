import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { parseCsv } from "@/lib/sources/tabularParser";
import { repoPath } from "@/lib/pipeline/io";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const UIS_SOURCE_URL = "https://databrowser.uis.unesco.org/";
const UIS_SOURCE_NAME = "UNESCO UIS";

const INDICATOR_ID_TO_METRIC: Record<string, { metric_id: string; unit: string }> = {
  "LR.AG15T99": { metric_id: "literacy_rate", unit: "percent" },
  "CR.1": { metric_id: "primary_completion_rate", unit: "percent" },
  "CR.2": { metric_id: "secondary_completion_rate", unit: "percent" },
  "GER.5T8": { metric_id: "tertiary_enrollment_rate", unit: "percent" },
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function isNationalCountryGeoUnit(geoUnit: string): boolean {
  return /^[A-Z]{3}$/.test(geoUnit.trim());
}

function isNationalTotalDisaggregation(record: ManualRecord): boolean {
  const sex = normalizeToken(getField(record, ["sex", "gender"]));
  const age = normalizeToken(getField(record, ["age", "age_range", "agegroup"]));
  const location = normalizeToken(getField(record, ["location", "residence"]));

  if (sex && sex !== "total" && sex !== "both sexes" && sex !== "_t" && sex !== "both") {
    return false;
  }
  if (age && age !== "total" && age !== "_t" && !age.includes("15+")) {
    return false;
  }
  if (location && location !== "total" && location !== "_t" && location !== "both") {
    return false;
  }
  return true;
}

function resolveMetricFromName(name: string): { metric_id: string; unit: string } | null {
  const normalized = name.toLowerCase();

  if (
    normalized.includes("literacy rate") &&
    normalized.includes("both sexes") &&
    (normalized.includes("adult") || normalized.includes("15+")) &&
    !normalized.includes("youth")
  ) {
    return { metric_id: "literacy_rate", unit: "percent" };
  }

  if (
    normalized.includes("completion rate") &&
    normalized.includes("primary") &&
    normalized.includes("both sexes")
  ) {
    return { metric_id: "primary_completion_rate", unit: "percent" };
  }

  if (
    normalized.includes("completion rate") &&
    normalized.includes("lower secondary") &&
    normalized.includes("both sexes")
  ) {
    return { metric_id: "secondary_completion_rate", unit: "percent" };
  }

  if (
    (normalized.includes("gross enrolment ratio") || normalized.includes("gross enrollment ratio")) &&
    normalized.includes("tertiary") &&
    normalized.includes("both sexes")
  ) {
    return { metric_id: "tertiary_enrollment_rate", unit: "percent" };
  }

  return null;
}

function resolveMetric(
  indicatorId: string,
  indicatorNames: Map<string, string>,
): { metric_id: string; unit: string } | null {
  const mapped = INDICATOR_ID_TO_METRIC[indicatorId];
  if (mapped) {
    return mapped;
  }

  const indicatorName = indicatorNames.get(indicatorId);
  if (!indicatorName) {
    return null;
  }

  return resolveMetricFromName(indicatorName);
}

function loadIndicatorNames(rawFilesRead: string[]): Map<string, string> {
  const names = new Map<string, string>();
  const dataFile = rawFilesRead.find((filePath) => path.basename(filePath) === "data.csv");
  if (!dataFile) {
    return names;
  }

  const indicatorsPath = path.join(path.dirname(repoPath(...dataFile.split("/"))), "indicators.csv");
  try {
    const content = readFileSync(indicatorsPath, "utf8");
    for (const record of parseCsv(content)) {
      const indicatorId = getField(record, ["indicatorid", "indicator_id"]);
      const name = getField(record, ["name", "indicator_name"]);
      if (indicatorId && name) {
        names.set(indicatorId, name);
      }
    }
  } catch {
    return names;
  }

  return names;
}

function buildRawRecordId(countryCode: string, year: string, metricId: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, metricId, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function isEmptyValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.toLowerCase() === "nan";
}

function transformRow(
  record: ManualRecord,
  indicatorNames: Map<string, string>,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow | null {
  const indicatorId = getField(record, ["indicatorid", "indicator_id"]);
  const geoUnit = getField(record, ["geounit", "geo_unit", "ref_area", "country_code", "iso3"]);
  const countryCode = resolveMvpCountry(geoUnit);

  if (!indicatorId) {
    incrementSkip(skipReasons, "missing_required_field");
    return null;
  }

  if (!geoUnit) {
    incrementSkip(skipReasons, "missing_country");
    return null;
  }

  if (!isNationalCountryGeoUnit(geoUnit)) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  if (!isNationalTotalDisaggregation(record)) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const metric = resolveMetric(indicatorId, indicatorNames);
  if (!metric) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const year = getField(record, ["year", "time_period"]);
  if (!year) {
    incrementSkip(skipReasons, "missing_required_field");
    return null;
  }

  const value = getField(record, ["value", "obs_value", "metric_value"]);
  if (isEmptyValue(value)) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  const qualifier = getField(record, ["qualifier"]);
  const indicatorName = indicatorNames.get(indicatorId);

  return {
    country_code: countryCode,
    year,
    metric_id: metric.metric_id,
    value,
    unit: metric.unit,
    source_url: UIS_SOURCE_URL,
    source_name: UIS_SOURCE_NAME,
    raw_record_id: buildRawRecordId(countryCode, year, metric.metric_id, value),
    calculation: "",
    notes: [indicatorName ? "uis_indicator=" + indicatorName : "", qualifier ? "qualifier=" + qualifier : ""]
      .filter(Boolean)
      .join("; "),
  };
}

function dedupeMetricRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  const byKey = new Map<string, CanonicalMetricRow>();
  for (const row of rows) {
    byKey.set(row.country_code + ":" + row.year + ":" + row.metric_id, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) return country;
    const year = a.year.localeCompare(b.year);
    if (year !== 0) return year;
    return a.metric_id.localeCompare(b.metric_id);
  });
}

export function transformUnescoUis(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const indicatorNames = loadIndicatorNames(rawFilesRead);
  const rows: CanonicalMetricRow[] = [];

  for (const record of records) {
    const row = transformRow(record, indicatorNames, skipReasons);
    if (row) {
      rows.push(row);
    }
  }

  const deduped = dedupeMetricRows(rows);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "unesco_uis",
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
