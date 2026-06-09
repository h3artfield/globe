import path from "node:path";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

export type UcdpEventRow = {
  event_id: string;
  event_date: string;
  year: number;
  country_codes: string[];
  event_type: string;
  event_category: string;
  headline: string;
  summary: string;
  notes: string;
};

type UcdpEventsFile = {
  source_id: string;
  events: UcdpEventRow[];
};

const UCDP_EVENTS_PATH = repoPath("data", "processed", "events", "ucdp", "events.v1.json");

let cachedEvents: UcdpEventRow[] | null = null;

export function ucdpEventsRelativePath(): string {
  return path.relative(process.cwd(), UCDP_EVENTS_PATH).replaceAll("\\", "/");
}

export async function loadUcdpEvents(): Promise<UcdpEventRow[]> {
  if (cachedEvents) {
    return cachedEvents;
  }
  if (!(await pathExists(UCDP_EVENTS_PATH))) {
    return [];
  }
  const payload = await readJsonFile<UcdpEventsFile>(UCDP_EVENTS_PATH);
  cachedEvents = payload.events ?? [];
  return cachedEvents;
}

export function isActiveConflictEvent(event: UcdpEventRow): boolean {
  if (event.event_type.toLowerCase().includes("conflict")) {
    return true;
  }
  if (event.event_category === "security") {
    return true;
  }
  if (/intensity_level=[12]/.test(event.notes)) {
    return true;
  }
  return false;
}

export function eventOnOrBeforeYear(event: UcdpEventRow, asOfYear: number): boolean {
  return event.year <= asOfYear;
}

export function eventInDateWindow(
  event: UcdpEventRow,
  windowStart: string,
  windowEnd: string,
): boolean {
  return event.event_date >= windowStart && event.event_date <= windowEnd;
}
