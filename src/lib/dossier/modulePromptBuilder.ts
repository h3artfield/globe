import type { MetricValue, RagChunk } from "@/types/pipeline";

export function buildSourceGroundedModulePrompt(input: {
  countryCode: string;
  moduleName: string;
  questions: string[];
  chunks: RagChunk[];
  metrics: MetricValue[];
}): string {
  return [
    `Generate ${input.countryCode}.${input.moduleName} using only supplied context.`,
    "Do not use model memory. Unsupported claims must become review items.",
    "Separate fact, metric, interpretation, strategic_inference, and scenario.",
    "Every claim must cite source_id, chunk_id, metric_id, event_id, raw_file_path, or Wikipedia revision ID.",
    "",
    "Questions:",
    ...input.questions.map((question) => `- ${question}`),
    "",
    "Chunks:",
    ...input.chunks.map((chunk) => `- ${chunk.chunk_id}: ${chunk.text.slice(0, 300)}`),
    "",
    "Metrics:",
    ...input.metrics.map((metric) => `- ${metric.metric_id}: ${metric.value} ${metric.unit} (${metric.year}) source=${metric.source_id}`),
  ].join("\n");
}
