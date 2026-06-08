import type { ManualRecord } from "@/lib/sources/tabularParser";
import { cowCcodeToIso3 } from "./cowCountryCodes";
import { getField } from "./rawFiles";
import { incrementSkip, matchesMvpRelationship } from "./mvpFilter";
import type { CanonicalEventRow, TransformStats } from "./types";

const COW_SOURCE_URL = "https://correlatesofwar.org/data-sets/";
const COW_SOURCE_NAME = "Correlates of War";

const ALLIANCE_DERIVED_EVENT_TYPES = [
  "defense_pact",
  "neutrality_pact",
  "nonaggression_pact",
  "entente",
  "alliance",
] as const;

function isTruthyFlag(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function deriveAllianceEventType(record: ManualRecord): string | null {
  const types: string[] = [];
  if (isTruthyFlag(getField(record, ["defense"]))) types.push("defense_pact");
  if (isTruthyFlag(getField(record, ["neutrality"]))) types.push("neutrality_pact");
  if (isTruthyFlag(getField(record, ["nonaggression"]))) types.push("nonaggression_pact");
  if (isTruthyFlag(getField(record, ["entente"]))) types.push("entente");
  if (types.length === 0) return null;
  if (types.length === 1) return types[0];
  return "alliance";
}

function buildCowDateFromFields(
  record: ManualRecord,
  yearFields: readonly string[],
  monthFields: readonly string[],
  dayFields: readonly string[],
): string {
  const year = getField(record, yearFields);
  const month = getField(record, monthFields);
  const day = getField(record, dayFields);

  if (!year || year === "-9" || year === "-8") return "";

  const monthValue = month && month !== "-9" && month !== "-8" ? month : "01";
  const dayValue = day && day !== "-9" && day !== "-8" ? day : "01";
  const parsed = new Date(
    year + "-" + monthValue.padStart(2, "0") + "-" + dayValue.padStart(2, "0"),
  );
  if (Number.isNaN(parsed.getTime())) {
    return year + "-01-01";
  }
  return parsed.toISOString().slice(0, 10);
}

function buildCowDate(record: ManualRecord, prefix: "start" | "end"): string {
  const year = getField(record, [
    prefix + "year",
    prefix + "_year",
    prefix + "year1",
    prefix + "year2",
  ]);
  const month = getField(record, [prefix + "month", prefix + "_month", prefix + "month1", prefix + "month2"]);
  const day = getField(record, [prefix + "day", prefix + "_day", prefix + "day1", prefix + "day2"]);

  if (!year) return "";
  const monthValue = month || "01";
  const dayValue = day || "01";
  const parsed = new Date(year + "-" + monthValue.padStart(2, "0") + "-" + dayValue.padStart(2, "0"));
  if (Number.isNaN(parsed.getTime())) {
    return year + "-01-01";
  }
  return parsed.toISOString().slice(0, 10);
}

function buildCowStartDate(record: ManualRecord): string {
  return (
    buildCowDateFromFields(
      record,
      ["dyad_st_year"],
      ["dyad_st_month"],
      ["dyad_st_day"],
    ) ||
    buildCowDate(record, "start") ||
    getField(record, ["event_date", "year"])
  );
}

function buildCowEndDate(record: ManualRecord): string {
  return (
    buildCowDateFromFields(
      record,
      ["dyad_end_year"],
      ["dyad_end_month"],
      ["dyad_end_day"],
    ) || buildCowDate(record, "end")
  );
}

function extractDyadCountries(record: ManualRecord): string[] {
  const codeA = cowCcodeToIso3(getField(record, ["ccode1", "state1", "member1", "statea"]));
  const codeB = cowCcodeToIso3(getField(record, ["ccode2", "state2", "member2", "stateb"]));
  const codes = [codeA, codeB].filter((code): code is string => Boolean(code));
  return [...new Set(codes)].sort();
}

export function resolveCowEventType(record: ManualRecord): string {
  const direct = getField(record, [
    "war_type",
    "wartype",
    "type_of_alliance",
    "type_of_ally",
    "event_type",
    "war_name",
    "warname",
    "alliance_type",
  ]);
  if (direct) return direct;
  return deriveAllianceEventType(record) ?? "";
}

export function buildCowSourceId(record: ManualRecord, eventType: string): string {
  const version4id = getField(record, ["version4id"]);
  const baseId = getField(record, [
    "war_num",
    "warnum",
    "warid",
    "alliance_id",
    "version4id",
    "id",
    "version_id",
    "source_id",
  ]);
  if (!baseId) return "";
  if (version4id && version4id === baseId && eventType) {
    return `${version4id}:${eventType}`;
  }
  return baseId;
}

export function transformCorrelatesOfWar(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalEventRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalEventRow[] = [];

  for (const record of records) {
    const countryCodes = extractDyadCountries(record);
    if (!countryCodes.length) {
      incrementSkip(skipReasons, "unmapped_country_code");
      continue;
    }
    if (!matchesMvpRelationship(countryCodes)) {
      incrementSkip(skipReasons, "non_mvp_relationship");
      continue;
    }

    const eventType = resolveCowEventType(record);
    const eventDate = buildCowStartDate(record);
    if (!eventDate) {
      incrementSkip(skipReasons, "missing_date");
      continue;
    }

    const sourceId = buildCowSourceId(record, eventType);
    if (!sourceId || !eventType) {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const actors = [
      getField(record, ["state_names", "statenames", "side_a", "side_b"]),
      getField(record, ["state_name1", "state_name2"]),
      getField(record, ["member1", "member2"]),
    ]
      .filter(Boolean)
      .join("|");

    const endDate = buildCowEndDate(record);
    const notes = [
      getField(record, ["notes", "war_name", "warname", "alliance_type"]),
      endDate ? "end_date=" + endDate : "",
    ]
      .filter(Boolean)
      .join("; ");

    rows.push({
      source_id: sourceId,
      source_name: getField(record, ["source_name"]) || COW_SOURCE_NAME,
      source_url: getField(record, ["source_url"]) || COW_SOURCE_URL,
      event_date: eventDate.length === 4 ? eventDate + "-01-01" : eventDate,
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
      sourceId: "correlates_of_war",
      rawFilesRead,
      rowsWritten: deduped.length,
      rowsRead: records.length,
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
    byKey.set(row.source_id + ":" + row.event_date + ":" + row.country_codes + ":" + row.event_type, row);
  }
  return [...byKey.values()].sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export { ALLIANCE_DERIVED_EVENT_TYPES };
