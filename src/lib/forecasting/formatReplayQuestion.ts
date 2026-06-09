import type { ReplayTemplate } from "@/types/forecasting";

export function formatReplayQuestion(
  template: ReplayTemplate,
  targetId: string,
  asOfYear: number = template.default_as_of_year,
): string {
  return template.question_template
    .replaceAll("{target}", targetId)
    .replaceAll("{as_of_year}", String(asOfYear))
    .replaceAll("{resolution_year}", String(template.resolution_year));
}
