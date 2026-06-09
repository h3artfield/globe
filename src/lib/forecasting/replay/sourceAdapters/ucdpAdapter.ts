import type { ReplaySession } from "@/types/forecasting";
import {
  eventInDateWindow,
  eventOnOrBeforeYear,
  isActiveConflictEvent,
  loadUcdpEvents,
  ucdpEventsRelativePath,
  type UcdpEventRow,
} from "@/lib/forecasting/replay/loadUcdpEvents";
import type {
  ReplayEvidenceIncludedRecord,
  ReplayResolutionSourceRecord,
} from "@/types/forecasting";
import type { ReplaySourceAdapter } from "@/lib/forecasting/replay/sourceAdapters/types";

const SOURCE_ID = "ucdp";

function appliesToSession(session: ReplaySession): boolean {
  const spec = session.resolution_spec;
  return spec.kind === "event_exists" && spec.source_id === "ucdp";
}

function eventInvolvesTarget(event: UcdpEventRow, targetId: string): boolean {
  return event.country_codes.includes(targetId);
}

function eventToEvidence(event: UcdpEventRow): ReplayEvidenceIncludedRecord {
  return {
    record_id: event.event_id,
    source_id: SOURCE_ID,
    label: `${event.event_type} (${event.event_date})`,
    year: event.year,
    date: event.event_date,
    value_summary: event.summary || event.headline,
  };
}

function eventToResolutionSource(event: UcdpEventRow): ReplayResolutionSourceRecord {
  return {
    record_id: event.event_id,
    source_id: SOURCE_ID,
    label: `${event.event_type} (${event.event_date})`,
    year: event.year,
    date: event.event_date,
    value_summary: event.summary || event.headline,
  };
}

export const ucdpAdapter: ReplaySourceAdapter = {
  source_id: SOURCE_ID,

  canBuildEvidenceSnapshot(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  canResolve(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  async buildEvidenceSnapshot(session) {
    const events = await loadUcdpEvents();
    const path = ucdpEventsRelativePath();
    if (events.length === 0) {
      return {
        included_records: [],
        missing_reason: SOURCE_ID,
        excluded_future_records_count: 0,
        source_paths: [],
        confidence: "low",
        limitations: ["UCDP events file not found or empty."],
      };
    }

    const target = session.target.target_id;
    const cutoff = session.forecast_year;
    const relevant = events.filter(
      (event) =>
        eventInvolvesTarget(event, target) &&
        isActiveConflictEvent(event),
    );
    const included = relevant.filter((event) => eventOnOrBeforeYear(event, cutoff));
    const excluded = relevant.length - included.length;

    if (included.length === 0) {
      return {
        included_records: [],
        missing_reason: SOURCE_ID,
        excluded_future_records_count: excluded,
        source_paths: [path],
        confidence: "low",
        limitations: [
          `No UCDP active-conflict events at or before ${cutoff} involving ${target}.`,
        ],
      };
    }

    return {
      included_records: included.map(eventToEvidence),
      missing_reason: null,
      excluded_future_records_count: excluded,
      source_paths: [path],
      confidence: excluded > 0 ? "medium" : "high",
      limitations: ["UCDP event typing in processed data is coarse; verify conflict mapping."],
    };
  },

  async resolve(session) {
    const spec = session.resolution_spec;
    if (spec.kind !== "event_exists") {
      return resolveMissing("Invalid resolution spec for UCDP adapter");
    }

    const events = await loadUcdpEvents();
    const path = ucdpEventsRelativePath();
    if (events.length === 0) {
      return resolveMissing("UCDP events file not found or empty");
    }

    const target = session.target.target_id;
    const matches = events.filter(
      (event) =>
        eventInvolvesTarget(event, target) &&
        isActiveConflictEvent(event) &&
        eventInDateWindow(event, spec.window_start, spec.window_end),
    );

    if (matches.length === 0) {
      return {
        outcome: "no",
        resolved_value: false,
        prior_value: null,
        comparison_value: false,
        source_records: [],
        source_paths: [path],
        confidence: "medium",
        limitations: [
          `No active UCDP conflicts involving ${target} in window ${spec.window_start} to ${spec.window_end}.`,
        ],
      };
    }

    return {
      outcome: "yes",
      resolved_value: true,
      prior_value: null,
      comparison_value: true,
      source_records: matches.map(eventToResolutionSource),
      source_paths: [path],
      confidence: "high",
      limitations: [],
    };
  },
};

function resolveMissing(message: string) {
  return {
    outcome: "missing_evidence" as const,
    resolved_value: null,
    prior_value: null,
    comparison_value: null,
    source_records: [],
    source_paths: [],
    confidence: "low" as const,
    limitations: [message],
  };
}
