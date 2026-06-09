import { createHash } from "node:crypto";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const UNODC_SOURCE_URL = "https://data.unodc.org/";
const UNODC_SOURCE_NAME = "UNODC";
const VICTIMS_INDICATOR = "victims of intentional homicide";

const UNIT_TO_METRIC: Record<string, { metric_id: string; unit: string }> = {
  counts: { metric_id: "homicide_count", unit: "count" },
  "rate per 100,000 population": { metric_id: "homicide_rate_per_100k", unit: "per_100k" },
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function isCountryTotalRow(record: ManualRecord): boolean {
  const dimension = normalizeToken(getField(record, ["dimension"]));
  const category = normalizeToken(getField(record, ["category"]));
  const sex = normalizeToken(getField(record, ["sex"]));
  const age = normalizeToken(getField(record, ["age"]));
  return dimension === "total" && category === "total" && sex === "total" && age === "total";
}

function resolveMetric(record: ManualRecord): { metric_id: string; unit: string } | null {
  const indicator = normalizeToken(getField(record, ["indicator", "indicator_name"]));
  if (indicator !== VICTIMS_INDICATOR) {
    return null;
  }

  const unitRaw = normalizeToken(getField(record, ["unit of measurement", "unit", "unit_of_measurement"]));
  return UNIT_TO_METRIC[unitRaw] ?? null;
}

function buildRawRecordId(countryCode: string, year: string, metricId: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, metricId, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function transformRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow | null {
  const iso3Raw = getField(record, ["iso3_code", "country_iso3", "iso3", "country_code"]);
  const countryRaw = getField(record, ["country", "country_or_area", "country_name"]);
  const countryCode = resolveMvpCountry(iso3Raw || countryRaw);

  if (!iso3Raw && !countryRaw) {
    incrementSkip(skipReasons, "missing_country");
    return null;
  }
  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  if (!isCountryTotalRow(record)) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const metric = resolveMetric(record);
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
  if (!value) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  const sourceNote = getField(record, ["source"]);

  return {
    country_code: countryCode,
    year,
    metric_id: metric.metric_id,
    value,
    unit: metric.unit,
    source_url: UNODC_SOURCE_URL,
    source_name: UNODC_SOURCE_NAME,
    raw_record_id: buildRawRecordId(countryCode, year, metric.metric_id, value),
    calculation: "",
    notes: sourceNote ? "unodc_source=" + sourceNote : "",
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

export function transformUnodc(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalMetricRow[] = [];

  for (const record of records) {
    const row = transformRow(record, skipReasons);
    if (row) {
      rows.push(row);
    }
  }

  const deduped = dedupeMetricRows(rows);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "unodc",
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
