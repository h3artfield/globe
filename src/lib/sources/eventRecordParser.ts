import { createHash } from "node:crypto";
import { buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { mapToIso3 } from "@/lib/sources/countryCodeMapper";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import type { ConfidenceLevel } from "@/types/rag";
import type { WorldEvent } from "@/types/worldModel";

const MVP_COUNTRY_SET = new Set<string>(MVP_COUNTRIES);

export const EVENT_REQUIRED_FIELDS = [
  "source_id",
  "source_name",
  "source_url",
  "event_date",
  "country_codes",
  "actors",
  "event_type",
  "confidence",
  "notes",
] as const;

export function findEventField(record: ManualRecord, names: readonly string[]): string {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== "") {
      return String(record[name]).trim();
    }
  }
  return "";
}

export function isExampleEventRow(record: ManualRecord): boolean {
  const notes = findEventField(record, ["notes"]).toUpperCase();
  return notes.includes("EXAMPLE_ONLY");
}

export function parseCountryCodes(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => (typeof value === "string" ? mapToIso3(value) : null))
          .filter((value): value is string => Boolean(value && MVP_COUNTRY_SET.has(value)));
      }
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[|,;]/)
    .map((value) => mapToIso3(value.trim()))
    .filter((value): value is string => Boolean(value && MVP_COUNTRY_SET.has(value)));
}

export function parseActors(raw: string): string[] {
  if (!raw) return [];
  if (raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map((value) => String(value).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return raw
    .split(/[|,;]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseEventDate(raw: string): { isoDate: string; year: number } | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const isoDate = parsed.toISOString().slice(0, 10);
  return { isoDate, year: parsed.getUTCFullYear() };
}

export function parseConfidenceLevel(raw: string): ConfidenceLevel {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase();
  if (["high", "medium", "low", "unknown"].includes(lower)) {
    return lower as ConfidenceLevel;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return "unknown";
  if (numeric >= 0.75 || numeric >= 75) return "high";
  if (numeric >= 0.45 || numeric >= 45) return "medium";
  if (numeric > 0) return "low";
  return "unknown";
}

export function buildStableEventId(adapterSourceId: string, record: ManualRecord): string {
  const recordSourceId = findEventField(record, ["source_id", "event_id"]);
  if (recordSourceId) {
    return adapterSourceId + ":" + recordSourceId;
  }
  const fingerprint = [
    adapterSourceId,
    findEventField(record, ["event_date"]),
    findEventField(record, ["country_codes"]),
    findEventField(record, ["actors"]),
    findEventField(record, ["event_type"]),
  ].join("|");
  const hash = createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
  return adapterSourceId + ":" + hash;
}

export function inferRelationshipId(countryCodes: string[]): string | null {
  if (countryCodes.length < 2) return null;
  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const countries = relationshipId.split("_");
    if (countries.every((code) => countryCodes.includes(code))) {
      return relationshipId;
    }
  }
  if (countryCodes.length === 2) {
    return buildRelationshipId(
      normalizeCountryCode(countryCodes[0]),
      normalizeCountryCode(countryCodes[1]),
    );
  }
  return null;
}

export function categorizeEventType(eventType: string): string {
  const lower = eventType.toLowerCase();
  if (/(security|battle|violence|conflict|military|protest|riot|attack|war)/.test(lower)) {
    return "security";
  }
  if (/(diplomatic|treaty|summit|foreign|embassy|sanction)/.test(lower)) {
    return "foreign_policy";
  }
  if (/(economic|trade|market|gdp|currency|finance)/.test(lower)) {
    return "economic";
  }
  if (/(cultural|social|election|referendum)/.test(lower)) {
    return "cultural_social";
  }
  return "domestic";
}

export function recordToWorldEvent(adapterSourceId: string, record: ManualRecord): WorldEvent | null {
  const countryCodes = parseCountryCodes(findEventField(record, ["country_codes"]));
  const eventDate = parseEventDate(findEventField(record, ["event_date"]));
  const eventType = findEventField(record, ["event_type"]);
  const sourceUrl = findEventField(record, ["source_url"]);
  const sourceName = findEventField(record, ["source_name"]);
  const notes = findEventField(record, ["notes"]);
  const actors = parseActors(findEventField(record, ["actors"]));

  if (!countryCodes.length || !eventDate || !eventType || !sourceUrl) {
    return null;
  }

  const recordSourceId = findEventField(record, ["source_id"]) || adapterSourceId;
  const headline = findEventField(record, ["headline", "summary"]) || eventType;
  const summary = findEventField(record, ["summary", "headline"]) || notes || eventType;

  return {
    event_id: buildStableEventId(adapterSourceId, record),
    event_date: eventDate.isoDate,
    year: eventDate.year,
    country_codes: countryCodes,
    relationship_id: inferRelationshipId(countryCodes),
    event_type: eventType,
    event_category: categorizeEventType(eventType),
    headline,
    summary,
    actors,
    locations: [],
    importance_score: null,
    domestic_impact_score: null,
    international_impact_score: null,
    economic_impact_score: null,
    security_impact_score: null,
    regime_impact_score: null,
    long_term_importance: "medium",
    source_ids: [recordSourceId, adapterSourceId],
    claim_type: "fact",
    confidence: parseConfidenceLevel(findEventField(record, ["confidence"])),
    notes,
  };
}
