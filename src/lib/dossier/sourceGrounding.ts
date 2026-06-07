import type { CountryClaim, MetricValue, RagChunk } from "@/types/pipeline";

export function claimHasGrounding(claim: CountryClaim): boolean {
  return (
    claim.source_ids.length > 0 ||
    claim.notes.includes("chunk_id=") ||
    claim.notes.includes("metric_id=") ||
    claim.notes.includes("event_id=") ||
    claim.notes.includes("raw_file_path=") ||
    claim.notes.includes("revision_id=")
  );
}

export function metricGrounding(metric: MetricValue): string[] {
  return [metric.source_id, metric.metric_id, metric.raw_file_path, metric.raw_record_id].filter(
    (value): value is string => Boolean(value),
  );
}

export function chunkGrounding(chunk: RagChunk): string[] {
  return [chunk.chunk_id, ...chunk.source_ids, ...(chunk.metric_ids ?? [])];
}
