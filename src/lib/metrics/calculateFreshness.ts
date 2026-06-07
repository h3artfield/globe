import type { FreshnessRequirement, FreshnessStatus } from "@/types/pipeline";

export function calculateFreshnessStatus(
  year: number | null,
  requirement: FreshnessRequirement,
  now = new Date(),
): FreshnessStatus {
  if (!year || requirement === "unknown") {
    return "unknown";
  }

  const age = now.getUTCFullYear() - year;

  if (requirement === "static_or_historical") {
    return "fresh";
  }
  if (requirement === "monthly_or_quarterly" || requirement === "latest_available_year") {
    return age <= 1 ? "fresh" : age <= 3 ? "acceptable" : "stale";
  }
  if (requirement === "annual") {
    return age <= 2 ? "fresh" : age <= 5 ? "acceptable" : "stale";
  }

  return "unknown";
}
