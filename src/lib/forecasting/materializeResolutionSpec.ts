import type { ResolutionSpec } from "@/types/forecasting";

export function materializeResolutionSpec(
  spec: ResolutionSpec,
  asOfYear: number,
  resolutionYear: number,
): ResolutionSpec {
  if (spec.kind === "event_exists") {
    return {
      ...spec,
      window_start: substituteYearTokens(spec.window_start, asOfYear, resolutionYear),
      window_end: substituteYearTokens(spec.window_end, asOfYear, resolutionYear),
    };
  }
  return structuredClone(spec);
}

function substituteYearTokens(value: string, asOfYear: number, resolutionYear: number): string {
  return value
    .replaceAll("{as_of_year}", String(asOfYear))
    .replaceAll("{resolution_year}", String(resolutionYear));
}
