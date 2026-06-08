import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ProcessedEventsFile } from "@/lib/sources/adapters/eventManualFileAdapter";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";
import type { WorldEvent } from "@/types/worldModel";

export type NationalEventTimeline = {
  country_code: string;
  version: string;
  last_updated: string;
  events: WorldEvent[];
  coverage: {
    status: string;
    warning?: string;
  };
};

export type TopEventsYearBucket = {
  year: number;
  domestic_events: string[];
  foreign_policy_events: string[];
  economic_events: string[];
  security_events: string[];
  cultural_social_events: string[];
};

export type TopEventsFile = {
  country_code: string;
  period: string;
  years: TopEventsYearBucket[];
  coverage: {
    status: string;
    warning?: string;
  };
};

export type RelationshipEventTimeline = {
  relationship_id: string;
  countries: string[];
  version: string;
  last_updated: string;
  events: WorldEvent[];
  coverage: {
    status: string;
    warning?: string;
  };
};

function dedupeEvents(events: WorldEvent[]): WorldEvent[] {
  const byId = new Map<string, WorldEvent>();
  for (const event of events) {
    byId.set(event.event_id, event);
  }
  return [...byId.values()].sort((a, b) => a.event_date.localeCompare(b.event_date));
}

function eventLabel(event: WorldEvent): string {
  return event.headline || event.event_id;
}

type TopEventsCategoryKey = Exclude<keyof TopEventsYearBucket, "year">;

function topEventsBucketKey(category: string): TopEventsCategoryKey {
  switch (category) {
    case "security":
      return "security_events";
    case "foreign_policy":
      return "foreign_policy_events";
    case "economic":
      return "economic_events";
    case "cultural_social":
      return "cultural_social_events";
    default:
      return "domestic_events";
  }
}

export async function loadAllProcessedEvents(): Promise<WorldEvent[]> {
  const eventsRoot = repoPath("data", "processed", "events");
  const entries = await readdir(eventsRoot, { withFileTypes: true }).catch(() => []);
  const events: WorldEvent[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(eventsRoot, entry.name, "events.v1.json");
    if (!(await pathExists(filePath))) continue;
    const payload = await readJsonFile<ProcessedEventsFile>(filePath);
    events.push(...payload.events);
  }

  return dedupeEvents(events);
}

export function mergeNationalTimeline(
  existing: NationalEventTimeline,
  countryCode: string,
  processedEvents: WorldEvent[],
): NationalEventTimeline {
  const countryEvents = processedEvents.filter((event) => event.country_codes.includes(countryCode));
  const mergedEvents = dedupeEvents([...existing.events, ...countryEvents]);
  const hasEvents = mergedEvents.length > 0;

  return {
    ...existing,
    country_code: countryCode,
    last_updated: new Date().toISOString().slice(0, 10),
    events: mergedEvents,
    coverage: hasEvents
      ? {
          status: "partial",
          warning: "Merged from processed manual event imports; review before production use.",
        }
      : existing.coverage,
  };
}

export function mergeTopEventsFile(
  existing: TopEventsFile,
  countryCode: string,
  processedEvents: WorldEvent[],
): TopEventsFile {
  const countryEvents = processedEvents.filter((event) => event.country_codes.includes(countryCode));
  const years = existing.years.map((bucket) => ({ ...bucket }));
  const yearIndex = new Map(years.map((bucket, index) => [bucket.year, index]));

  for (const event of countryEvents) {
    const index = yearIndex.get(event.year);
    if (index === undefined) continue;
    const bucketKey = topEventsBucketKey(event.event_category);
    const label = eventLabel(event);
    const bucket = years[index];
    if (!bucket[bucketKey].includes(label)) {
      bucket[bucketKey].push(label);
    }
  }

  const hasEvents = countryEvents.length > 0;
  return {
    ...existing,
    country_code: countryCode,
    years,
    coverage: hasEvents
      ? {
          status: "partial",
          warning: "Top events populated from processed manual event imports.",
        }
      : existing.coverage,
  };
}

export function mergeRelationshipTimeline(
  existing: RelationshipEventTimeline,
  relationshipId: string,
  processedEvents: WorldEvent[],
): RelationshipEventTimeline {
  const countries = relationshipId.split("_");
  const relationshipEvents = processedEvents.filter((event) => {
    if (event.relationship_id === relationshipId) return true;
    return countries.every((code) => event.country_codes.includes(code));
  });
  const mergedEvents = dedupeEvents([...existing.events, ...relationshipEvents]);
  const hasEvents = mergedEvents.length > 0;

  return {
    ...existing,
    relationship_id: relationshipId,
    countries,
    last_updated: new Date().toISOString().slice(0, 10),
    events: mergedEvents,
    coverage: hasEvents
      ? {
          status: "partial",
          warning: "Merged from processed manual event imports; review bilateral coverage.",
        }
      : existing.coverage,
  };
}

export async function loadExistingNationalTimeline(
  countryCode: string,
  fallback: NationalEventTimeline,
): Promise<NationalEventTimeline> {
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "countries",
    countryCode,
    "national_event_timeline.v1.json",
  );
  if (!(await pathExists(filePath))) return fallback;
  return readJsonFile<NationalEventTimeline>(filePath);
}

export async function loadExistingTopEvents(
  countryCode: string,
  fallback: TopEventsFile,
): Promise<TopEventsFile> {
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "countries",
    countryCode,
    "top_events_20_years.v1.json",
  );
  if (!(await pathExists(filePath))) return fallback;
  return readJsonFile<TopEventsFile>(filePath);
}

export async function loadExistingRelationshipTimeline(
  relationshipId: string,
  fallback: RelationshipEventTimeline,
): Promise<RelationshipEventTimeline> {
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "relationships",
    relationshipId,
    "relationship_event_timeline.v1.json",
  );
  if (!(await pathExists(filePath))) return fallback;
  return readJsonFile<RelationshipEventTimeline>(filePath);
}
