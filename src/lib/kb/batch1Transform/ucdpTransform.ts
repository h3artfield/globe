import type { ManualRecord } from "@/lib/sources/tabularParser";
import { cowCcodeToIso3 } from "./cowCountryCodes";
import { getField } from "./rawFiles";
import { incrementSkip, matchesMvpRelationship, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalEventRow, TransformStats } from "./types";

const UCDP_SOURCE_URL = "https://ucdp.uu.se/downloads/";
const UCDP_SOURCE_NAME = "UCDP";

function parseUcdpDate(record: ManualRecord): string {
  const direct = getField(record, ["event_date", "date_start", "start_date", "date"]);
  if (direct) {
    const parsed = new Date(direct);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const year = getField(record, ["year", "active_year"]);
  if (year) {
    return year + "-01-01";
  }

  return "";
}

function parseGwnoField(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((part) => cowCcodeToIso3(part.trim()))
    .filter((code): code is string => Boolean(code));
}

function extractCountryCodes(record: ManualRecord): string[] {
  const codes = new Set<string>();

  const location = getField(record, ["location", "country", "country_name", "location_inc", "where_description"]);
  for (const part of location.split(/[,;]/)) {
    const cleaned = part.trim().replace(/\s*\([^)]*\)\s*/g, "").trim();
    const iso = resolveMvpCountry(cleaned);
    if (iso) codes.add(iso);
  }

  for (const field of ["gwno_a", "gwno_b", "gwno_a_2nd", "gwno_b_2nd", "gwno_loc", "gwno", "country_id", "ccode"]) {
    for (const code of parseGwnoField(getField(record, [field]))) {
      codes.add(code);
    }
  }

  for (const sideName of [getField(record, ["side_a", "side_a_name"]), getField(record, ["side_b", "side_b_name"])]) {
    const normalized = sideName.replace(/^Government of /i, "").trim();
    const iso = resolveMvpCountry(normalized);
    if (iso) codes.add(iso);
  }

  return [...codes].sort();
}

function mapConflictType(raw: string): string {
  switch (raw.trim()) {
    case "1":
      return "intrastate_conflict";
    case "2":
      return "interstate_conflict";
    case "3":
      return "internationalized_intrastate_conflict";
    default:
      return raw || "conflict";
  }
}

function mapIntensityLevel(raw: string): string {
  switch (raw.trim()) {
    case "1":
      return "minor_conflict";
    case "2":
      return "war";
    default:
      return raw || "";
  }
}

export function transformUcdp(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalEventRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalEventRow[] = [];

  for (const record of records) {
    const countryCodes = extractCountryCodes(record);
    if (!countryCodes.length) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }
    if (!matchesMvpRelationship(countryCodes)) {
      incrementSkip(skipReasons, "non_mvp_relationship");
      continue;
    }

    const eventDate = parseUcdpDate(record);
    if (!eventDate) {
      incrementSkip(skipReasons, "missing_date");
      continue;
    }

    const dyadId = getField(record, ["dyad_id", "dyad_new_id", "id", "relid", "conflict_id", "source_id"]);
    const year = getField(record, ["year", "active_year"]);
    const sourceId = dyadId && year ? `${dyadId}:${year}` : dyadId;
    const conflictType = mapConflictType(
      getField(record, ["type_of_conflict", "type_of_violence", "event_type"]),
    );
    const intensity = mapIntensityLevel(getField(record, ["intensity_level"]));
    const eventType = conflictType || getField(record, ["conflict_name", "event_type"]);
    if (!sourceId || !eventType) {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const actors = [
      getField(record, ["side_a", "side_a_name"]),
      getField(record, ["side_b", "side_b_name"]),
    ]
      .filter(Boolean)
      .join("|");

    const notes = [
      getField(record, ["conflict_name", "dyad_name"]),
      getField(record, ["location"]) ? "location=" + getField(record, ["location"]) : "",
      intensity ? "intensity_level=" + getField(record, ["intensity_level"]) + `(${intensity})` : "",
      getField(record, ["type_of_conflict"]) ? "type_of_conflict=" + getField(record, ["type_of_conflict"]) : "",
      getField(record, ["best_est"]) ? "best_est=" + getField(record, ["best_est"]) : "",
      getField(record, ["deaths_civilians"]) ? "deaths_civilians=" + getField(record, ["deaths_civilians"]) : "",
    ]
      .filter(Boolean)
      .join("; ");

    rows.push({
      source_id: sourceId,
      source_name: getField(record, ["source_name"]) || UCDP_SOURCE_NAME,
      source_url: getField(record, ["source_url"]) || UCDP_SOURCE_URL,
      event_date: eventDate,
      country_codes: countryCodes.join("|"),
      actors,
      event_type: eventType,
      confidence: getField(record, ["confidence"]),
      notes,
    });
  }

  const deduped = dedupeEventRows(rows);

  return {
    rows: deduped,
    stats: {
      sourceId: "ucdp",
      rawFilesRead,
      rowsRead: records.length,
      rowsWritten: deduped.length,
      rowsSkipped: records.length - deduped.length,
      skipReasons,
      outputPath,
      implemented: true,
    },
  };
}

function dedupeEventRows(rows: CanonicalEventRow[]): CanonicalEventRow[] {
  const byKey = new Map<string, CanonicalEventRow>();
  for (const row of rows) {
    byKey.set(row.source_id, row);
  }
  return [...byKey.values()].sort((a, b) => a.event_date.localeCompare(b.event_date));
}
