import type { MetricValue, RagChunk } from "@/types/pipeline";
import type { Citation } from "@/types/vector";

export function citationsFromChunks(chunks: RagChunk[]): Citation[] {
  return chunks.flatMap((chunk) =>
    chunk.source_ids.length > 0
      ? chunk.source_ids.map((sourceId) => ({
          source_id: sourceId,
          module: chunk.module,
          chunk_id: chunk.chunk_id,
          country_code: chunk.country_code,
          relationship_id: chunk.relationship_id,
          confidence: chunk.confidence,
        }))
      : [
          {
            source_id: "missing_source",
            module: chunk.module,
            chunk_id: chunk.chunk_id,
            country_code: chunk.country_code,
            relationship_id: chunk.relationship_id,
            confidence: chunk.confidence,
          },
        ],
  );
}

export function citationsFromMetrics(metrics: MetricValue[]): Citation[] {
  return metrics
    .filter((metric) => metric.source_id)
    .map((metric) => ({
      source_id: metric.source_id ?? "unknown",
      source_name: metric.source_name,
      source_url: metric.source_url,
      retrieved_at: metric.retrieved_at,
      raw_file_path: metric.raw_file_path,
      metric_id: metric.metric_id,
      country_code: metric.country_code,
      confidence: metric.confidence,
    }));
}

export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = [
      citation.source_id,
      citation.chunk_id,
      citation.metric_id,
      citation.event_id,
      citation.country_code,
      citation.relationship_id,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
