import type { ReplayTemplate } from "@/types/forecasting";

export function formatReplayQuestion(template: ReplayTemplate, targetId: string): string {
  return template.question_template
    .replaceAll("{target}", targetId)
    .replaceAll("{as_of_year}", String(template.default_as_of_year))
    .replaceAll("{resolution_year}", String(template.resolution_year));
}
