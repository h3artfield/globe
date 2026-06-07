import type { CountryModule, ReviewQueueItem } from "@/types/pipeline";
import { HUMAN_REVIEW_COUNTRY_MODULES } from "./constants";
import { readJsonFile, repoPath, writeJsonFile, pathExists } from "./io";

const REVIEW_SOURCE_MAP: Record<string, string[]> = {
  founding_groups: ["manual_history_sources"],
  religion_history: ["manual_religion_sources"],
  leader_dossiers: ["manual_leader_sources"],
  adversary_narratives: ["manual_history_sources"],
  math_contributions: ["manual_philosophy_math_sources"],
  philosophy_contributions: ["manual_philosophy_math_sources"],
  future_scenarios: ["manual_history_sources", "manual_leader_sources"],
  game_theory_profile: ["manual_leader_sources", "manual_history_sources"],
};

export function moduleNeedsReview(module: CountryModule): boolean {
  return (
    HUMAN_REVIEW_COUNTRY_MODULES.includes(
      module.module as (typeof HUMAN_REVIEW_COUNTRY_MODULES)[number],
    ) &&
    module.claims.length === 0
  );
}

export function buildReviewQueueItem(
  countryCode: string,
  moduleName: string,
  sequence = 1,
): ReviewQueueItem {
  return {
    review_id: `${countryCode}-${moduleName}-${String(sequence).padStart(3, "0")}`,
    country_code: countryCode,
    module: moduleName,
    reason: "Structured data is insufficient. Requires source-backed narrative research.",
    required_questions: [
      `Which source-backed facts are required for ${moduleName}?`,
      `Which claims should remain open until human review?`,
    ],
    suggested_sources: REVIEW_SOURCE_MAP[moduleName] ?? ["manual_sources"],
    status: "pending",
    generation_status: "auto_generated_structured_data",
    created_at: new Date().toISOString(),
  };
}

export async function writeCountryReviewQueue(
  countryCode: string,
  modules: CountryModule[],
): Promise<ReviewQueueItem[]> {
  const items = modules
    .filter(moduleNeedsReview)
    .map((module, index) => buildReviewQueueItem(countryCode, module.module, index + 1));
  const filePath = repoPath("data", "review_queue", "countries", `${countryCode}.json`);

  await writeJsonFile(filePath, {
    country_code: countryCode,
    generated_at: new Date().toISOString(),
    items,
  });

  return items;
}

export async function loadCountryReviewQueue(countryCode: string): Promise<ReviewQueueItem[]> {
  const filePath = repoPath("data", "review_queue", "countries", `${countryCode}.json`);

  if (!(await pathExists(filePath))) {
    return [];
  }

  const payload = await readJsonFile<{ items: ReviewQueueItem[] }>(filePath);
  return payload.items;
}
