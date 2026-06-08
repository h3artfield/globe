import type { CountryClaim, RelationshipModule } from "@/types/pipeline";
import type { WorldEvent } from "@/types/worldModel";
import { ALLIANCE_DERIVED_EVENT_TYPES } from "@/lib/kb/batch1Transform/cowTransform";
import { emptyRelationshipWorldModule } from "@/lib/worldModel/defaults";

const ALLIANCE_EVENT_TYPE_SET = new Set<string>(ALLIANCE_DERIVED_EVENT_TYPES);

function worldEventToClaim(event: WorldEvent): CountryClaim {
  return {
    claim_id: event.event_id,
    text: `${event.event_date}: ${event.headline}${event.summary && event.summary !== event.headline ? ` — ${event.summary}` : ""}`,
    claim_type: "fact",
    source_ids: event.source_ids,
    confidence: event.confidence,
    last_verified: event.event_date,
    notes: event.notes,
  };
}

function isWarEvent(event: WorldEvent): boolean {
  const haystack = `${event.event_type} ${event.notes} ${event.headline}`.toLowerCase();
  return /interstate|war|intensity_level=2|type_of_conflict=2/.test(haystack);
}

function isCrisisEvent(event: WorldEvent): boolean {
  const haystack = `${event.event_type} ${event.notes} ${event.headline}`.toLowerCase();
  return isWarEvent(event) || /crisis|conflict|violence|military/.test(haystack);
}

export function isAllianceEvent(event: WorldEvent): boolean {
  const normalizedType = event.event_type.trim().toLowerCase().replace(/\s+/g, "_");
  if (ALLIANCE_EVENT_TYPE_SET.has(normalizedType)) {
    return true;
  }
  const haystack = `${event.event_type} ${event.notes} ${event.headline}`.toLowerCase();
  return /defense_pact|neutrality_pact|nonaggression_pact|\bentente\b|\balliance\b|type_of_alliance/.test(
    haystack,
  );
}

function eventsForModule(moduleName: string, events: WorldEvent[]): WorldEvent[] {
  switch (moduleName) {
    case "relationship_event_timeline":
      return events;
    case "war_history":
      return events.filter(isWarEvent);
    case "crisis_history":
      return events.filter(isCrisisEvent);
    case "alliance_status":
      return events.filter(isAllianceEvent);
    case "diplomatic_history":
      return events.filter(isAllianceEvent);
    default:
      return [];
  }
}

export function hydrateRelationshipModuleFromEvents(
  relationshipId: string,
  moduleName: string,
  events: WorldEvent[],
): RelationshipModule {
  const base = emptyRelationshipWorldModule(relationshipId, moduleName);
  const moduleEvents = eventsForModule(moduleName, events);
  if (moduleEvents.length === 0) {
    return base;
  }

  const claims = moduleEvents.map(worldEventToClaim);
  const sourceIds = Array.from(new Set(moduleEvents.flatMap((event) => event.source_ids)));

  return {
    ...base,
    summary: `${moduleEvents.length} bilateral event(s) merged from processed conflict/event imports.`,
    key_findings: moduleEvents.slice(-5).map((event) => `${event.event_date}: ${event.headline}`),
    claims,
    source_ids: sourceIds,
    open_questions: ["Review UCDP/COW/manual event claims before production use."],
    confidence: {
      overall: "low",
      weak_areas: ["review_status", "provenance"],
    },
  };
}
