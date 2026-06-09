import type { ReplayResolution, ReplayResolutionOutcome } from "@/types/forecasting";

export function binaryOutcomeValue(outcome: ReplayResolutionOutcome): 0 | 1 | null {
  if (outcome === "yes") {
    return 1;
  }
  if (outcome === "no") {
    return 0;
  }
  return null;
}

export function computeBrierScore(probabilityPercent: number, outcome: 0 | 1): number {
  const probabilityDecimal = probabilityPercent / 100;
  return (probabilityDecimal - outcome) ** 2;
}

export function computeDirectionCorrect(
  probabilityPercent: number,
  outcome: 0 | 1,
): boolean {
  return (
    (probabilityPercent >= 50 && outcome === 1) || (probabilityPercent < 50 && outcome === 0)
  );
}

export function scoringLimitationForOutcome(outcome: ReplayResolutionOutcome): string | null {
  if (outcome === "missing_evidence") {
    return "Resolution outcome is missing_evidence; Brier scoring requires a clear yes/no outcome.";
  }
  if (outcome === "void") {
    return "Resolution outcome is void; Brier scoring is not supported for this outcome shape yet.";
  }
  return null;
}

export function collectSourcePaths(
  resolution: ReplayResolution,
  extraPaths: string[] = [],
): string[] {
  return [...new Set([...resolution.source_paths, ...extraPaths])];
}
