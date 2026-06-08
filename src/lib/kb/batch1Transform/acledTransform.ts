import type { ManualRecord } from "@/lib/sources/tabularParser";
import { getField } from "./rawFiles";
import { incrementSkip, matchesMvpRelationship, resolveMvpCountries } from "./mvpFilter";
import type { CanonicalEventRow, TransformStats } from "./types";

const ACLED_SOURCE_URL = "https://acleddata.com/";
const ACLED_SOURCE_NAME = "ACLED";

function parseEventDate(raw: string, yearFallback: string): string {
  if (!raw && yearFallback) {
    return yearFallback + "-01-01";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function joinActors(record: ManualRecord): string {
  const actors = [
    getField(record, ["actor1", "actor_1", "assoc_actor_1"]),
    getField(record, ["actor2", "actor_2", "assoc_actor_2"]),
    getField(record, ["inter1", "inter_1"]),
    getField(record, ["inter2", "inter_2"]),
  ].filter(Boolean);
  return [...new Set(actors)].join("|");
}

export function transformAcled(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalEventRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalEventRow[] = [];

  for (const record of records) {
    const countryRaw = getField(record, ["country", "country_name", "iso", "iso3", "country_code"]);
    const countryCodes = resolveMvpCountries(
      countryRaw
        .split(/[|,;]/)
        .map((value) => value.trim())
        .filter(Boolean),
    );

    if (!countryRaw) {
      incrementSkip(skipReasons, "missing_country");
      continue;
    }
    if (!countryCodes.length) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }
    if (!matchesMvpRelationship(countryCodes)) {
      incrementSkip(skipReasons, "non_mvp_relationship");
      continue;
    }

    const eventDate = parseEventDate(
      getField(record, ["event_date", "event_date_d", "event_date_prec"]),
      getField(record, ["year"]),
    );
    if (!eventDate) {
      incrementSkip(skipReasons, "missing_date");
      continue;
    }

    const sourceId = getField(record, ["event_id_cnty", "event_id", "data_id", "source_id"]);
    const eventType = getField(record, ["event_type", "sub_event_type", "type"]);
    if (!sourceId || !eventType) {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const sourceUrl = getField(record, ["source_url", "source"]) || ACLED_SOURCE_URL;
    const notes = [
      getField(record, ["notes"]),
      getField(record, ["location"]) ? "location=" + getField(record, ["location"]) : "",
      getField(record, ["fatalities"]) ? "fatalities=" + getField(record, ["fatalities"]) : "",
    ]
      .filter(Boolean)
      .join("; ");

    rows.push({
      source_id: sourceId,
      source_name: getField(record, ["source_name"]) || ACLED_SOURCE_NAME,
      source_url: sourceUrl.startsWith("http") ? sourceUrl : ACLED_SOURCE_URL,
      event_date: eventDate,
      country_codes: countryCodes.join("|"),
      actors: joinActors(record),
      event_type: eventType,
      confidence: getField(record, ["confidence", "confidence_level"]),
      notes,
    });
  }

  const deduped = dedupeEventRows(rows);

  return {
    rows: deduped,
    stats: {
      sourceId: "acled",
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
