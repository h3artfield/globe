import type { ManualRecord } from "@/lib/sources/tabularParser";
import { getSourceMetricDefinition } from "@/lib/sources/sourceMetricDefinitions";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const VDEM_SOURCE_URL = "https://www.v-dem.net/data/the-v-dem-dataset/";
const VDEM_SOURCE_NAME = "V-Dem Institute";

const VDEM_COLUMN_TO_METRIC: Record<string, { metric_id: string; unit: string }> = {
  v2x_regime: { metric_id: "regime_type", unit: "category" },
  regime: { metric_id: "regime_type", unit: "category" },
  v2x_polyarchy: { metric_id: "electoral_democracy_index", unit: "index" },
  v2x_libdem: { metric_id: "liberal_democracy_index", unit: "index" },
  v2x_partipdem: { metric_id: "participatory_democracy_index", unit: "index" },
  v2x_delibdem: { metric_id: "deliberative_democracy_index", unit: "index" },
  v2x_egaldem: { metric_id: "egalitarian_democracy_index", unit: "index" },
  v2x_civlib: { metric_id: "civil_liberties_index", unit: "index" },
  v2x_rule: { metric_id: "rule_of_law_index", unit: "index" },
  v2x_jucon: { metric_id: "judicial_constraints_index", unit: "index" },
  v2x_legcon: { metric_id: "legislative_constraints_index", unit: "index" },
  v2x_corr: { metric_id: "political_corruption_index", unit: "index" },
  v2me_freexp_alt: { metric_id: "media_freedom_index", unit: "index" },
  v2x_freexp: { metric_id: "media_freedom_index", unit: "index" },
  v2x_academ: { metric_id: "academic_freedom_index", unit: "index" },
  v2xcl_acjst: { metric_id: "academic_freedom_index", unit: "index" },
  v2xel_fair: { metric_id: "election_fairness_index", unit: "index" },
};

function isLongFormat(record: ManualRecord): boolean {
  return Boolean(getField(record, ["metric_id", "indicator", "indicator_id"]));
}

function transformLongFormatRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow | null {
  const countryRaw = getField(record, ["country_code", "country_iso3", "iso3", "country", "refarea"]);
  const countryCode = resolveMvpCountry(countryRaw);
  if (!countryRaw) {
    incrementSkip(skipReasons, "missing_country");
    return null;
  }
  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  const metricId = getField(record, ["metric_id", "indicator", "indicator_id"]);
  const value = getField(record, ["value", "obs_value", "metric_value"]);
  const year = getField(record, ["year"]);

  if (!metricId || !getSourceMetricDefinition("vdem", metricId)) {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }
  if (!value) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  return {
    country_code: countryCode,
    year,
    metric_id: metricId,
    value,
    unit: getField(record, ["unit"]) || (getSourceMetricDefinition("vdem", metricId)?.unit ?? ""),
    source_url: getField(record, ["source_url"]) || VDEM_SOURCE_URL,
    source_name: getField(record, ["source_name"]) || VDEM_SOURCE_NAME,
    raw_record_id:
      getField(record, ["raw_record_id", "country_id", "id"]) ||
      countryCode + ":" + year + ":" + metricId,
    calculation: getField(record, ["calculation"]),
    notes: getField(record, ["notes"]),
  };
}

function transformWideFormatRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow[] {
  const countryRaw = getField(record, [
    "country_text_id",
    "country_name",
    "country",
    "country_code",
    "iso3",
    "country_iso3",
  ]);
  const countryCode = resolveMvpCountry(countryRaw);
  const year = getField(record, ["year"]);
  const countryId = getField(record, ["country_id", "id"]);

  if (!countryRaw) {
    incrementSkip(skipReasons, "missing_country");
    return [];
  }
  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return [];
  }
  if (!year) {
    incrementSkip(skipReasons, "missing_required_field");
    return [];
  }

  const output: CanonicalMetricRow[] = [];
  for (const [column, mapping] of Object.entries(VDEM_COLUMN_TO_METRIC)) {
    const value = getField(record, [column]);
    if (!value) {
      incrementSkip(skipReasons, "empty_value");
      continue;
    }
    if (!getSourceMetricDefinition("vdem", mapping.metric_id)) {
      incrementSkip(skipReasons, "unmapped_metric_column");
      continue;
    }

    output.push({
      country_code: countryCode,
      year,
      metric_id: mapping.metric_id,
      value,
      unit: mapping.unit,
      source_url: getField(record, ["source_url"]) || VDEM_SOURCE_URL,
      source_name: getField(record, ["source_name"]) || VDEM_SOURCE_NAME,
      raw_record_id: countryId ? countryId + ":" + year + ":" + column : countryCode + ":" + year + ":" + column,
      calculation: "",
      notes: "Transformed from V-Dem column " + column,
    });
  }

  return output;
}

export function transformVdem(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalMetricRow[] = [];
  let rowsRead = 0;

  for (const record of records) {
    rowsRead += 1;
    if (isLongFormat(record)) {
      const row = transformLongFormatRow(record, skipReasons);
      if (row) rows.push(row);
      continue;
    }

    rows.push(...transformWideFormatRow(record, skipReasons));
  }

  const deduped = dedupeMetricRows(rows);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "vdem",
      rawFilesRead,
      rowsRead,
      rowsWritten: deduped.length,
      rowsSkipped: skipped,
      skipReasons,
      outputPath,
      implemented: true,
    },
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
