import type {
  ForecastSourceRequest,
  ReplaySession,
  SourceFulfillmentRecord,
} from "@/types/forecasting";
import { resolveAdapterSourceId } from "@/lib/forecasting/replay/sourceAdapters/registry";

export type FulfillmentRecordFilterResult = {
  usable: SourceFulfillmentRecord[];
  rejected_irrelevant_count: number;
  rejected_future_count: number;
  rejected_source_count: number;
  rejected_target_count: number;
};

function yearFromRecord(record: SourceFulfillmentRecord): number | null {
  if (typeof record.year === "number" && Number.isFinite(record.year)) {
    return record.year;
  }
  if (record.date) {
    const match = /^(\d{4})/.exec(record.date);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function countryFromLabel(label: string): string | null {
  const match = /\(([A-Z]{3}),/.exec(label);
  return match ? match[1]! : null;
}

function isAllowedSource(recordSourceId: string, session: ReplaySession, requestSourceId: string): boolean {
  const normalizedRecord = resolveAdapterSourceId(recordSourceId);
  const normalizedRequest = resolveAdapterSourceId(requestSourceId);
  if (normalizedRecord !== normalizedRequest) {
    return false;
  }
  return session.allowed_source_ids.some(
    (allowed) => resolveAdapterSourceId(allowed) === normalizedRecord,
  );
}

function matchesTarget(record: SourceFulfillmentRecord, session: ReplaySession): boolean {
  if (session.target.target_type === "country") {
    const country = session.target.target_id;
    const labelCountry = countryFromLabel(record.label);
    if (labelCountry) {
      return labelCountry === country;
    }
    // Note-only fulfillments have no country tag; allow as qualitative context.
    return record.label === "operator note" || record.label.endsWith(".md") || record.label.endsWith(".txt");
  }

  if (session.target.target_type === "relationship") {
    const pair = session.target.target_id.replace("_", "-");
    const haystack = `${record.label} ${record.value_summary}`.toLowerCase();
    return haystack.includes(session.target.target_id.toLowerCase()) || haystack.includes(pair.toLowerCase());
  }

  return true;
}

function matchesTemplateMetric(record: SourceFulfillmentRecord, session: ReplaySession): boolean {
  const spec = session.resolution_spec;
  if (spec.kind !== "metric_compare_years" && spec.kind !== "metric_threshold") {
    return true;
  }
  const metricId = spec.metric_id;
  if (record.label.includes(metricId)) {
    return true;
  }
  // Note-only / markdown rows lack metric ids.
  if (!record.label.includes("(") && record.year === null) {
    return true;
  }
  return false;
}

export function filterFulfillmentRecordsForSession(
  records: SourceFulfillmentRecord[],
  request: ForecastSourceRequest,
  session: ReplaySession,
): FulfillmentRecordFilterResult {
  const usable: SourceFulfillmentRecord[] = [];
  let rejectedIrrelevant = 0;
  let rejectedFuture = 0;
  let rejectedSource = 0;
  let rejectedTarget = 0;

  for (const record of records) {
    const year = yearFromRecord(record);
    if (year !== null && year > request.cutoff_year) {
      rejectedFuture += 1;
      rejectedIrrelevant += 1;
      continue;
    }
    if (!isAllowedSource(record.source_id, session, request.requested_source_id)) {
      rejectedSource += 1;
      rejectedIrrelevant += 1;
      continue;
    }
    if (!matchesTarget(record, session)) {
      rejectedTarget += 1;
      rejectedIrrelevant += 1;
      continue;
    }
    if (!matchesTemplateMetric(record, session)) {
      rejectedIrrelevant += 1;
      continue;
    }
    usable.push(record);
  }

  return {
    usable,
    rejected_irrelevant_count: rejectedIrrelevant,
    rejected_future_count: rejectedFuture,
    rejected_source_count: rejectedSource,
    rejected_target_count: rejectedTarget,
  };
}

export function dedupeEvidenceRecords<T extends { record_id: string }>(records: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const record of records) {
    if (seen.has(record.record_id)) {
      continue;
    }
    seen.add(record.record_id);
    deduped.push(record);
  }
  return deduped;
}
