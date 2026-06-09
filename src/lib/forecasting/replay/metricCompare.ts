import type { ResolutionSpec } from "@/types/forecasting";
import type { ProcessedMetricRow } from "@/lib/forecasting/replay/loadCountryMetrics";
import { parseMetricNotes } from "@/lib/forecasting/replay/loadCountryMetrics";

export function applyComparator(
  left: number,
  right: number,
  comparator: "gt" | "gte" | "lt" | "lte",
): boolean {
  switch (comparator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
  }
}

export function filterMetricsBySource(
  metrics: ProcessedMetricRow[],
  sourceId: string,
  metricId: string,
): ProcessedMetricRow[] {
  return metrics.filter((row) => row.source_id === sourceId && row.metric_id === metricId);
}

export function filterBilateralMetrics(
  metrics: ProcessedMetricRow[],
  relationshipId: string,
): ProcessedMetricRow[] {
  return metrics.filter((row) => {
    const notes = parseMetricNotes(row.notes ?? "");
    return notes.relationship_id === relationshipId;
  });
}

export function metricValueAtYear(
  metrics: ProcessedMetricRow[],
  year: number,
): ProcessedMetricRow | null {
  return metrics.find((row) => row.year === year) ?? null;
}

export function bilateralTradeTotalAtYear(
  metrics: ProcessedMetricRow[],
  relationshipId: string,
  year: number,
): { total: number; rows: ProcessedMetricRow[] } | null {
  const bilateral = filterBilateralMetrics(metrics, relationshipId).filter((row) => row.year === year);
  const imports = bilateral.find((row) => row.metric_id === "imports_total_usd");
  const exports = bilateral.find((row) => row.metric_id === "exports_total_usd");
  if (!imports && !exports) {
    return null;
  }
  const total = (imports?.value ?? 0) + (exports?.value ?? 0);
  return { total, rows: [imports, exports].filter((row): row is ProcessedMetricRow => row != null) };
}

export function baselineYearFromSpec(spec: ResolutionSpec, sessionForecastYear: number): number {
  if (spec.kind === "metric_compare_years" && spec.baseline_year_from_as_of) {
    return sessionForecastYear;
  }
  if (spec.kind === "metric_threshold") {
    return spec.year;
  }
  return sessionForecastYear;
}

export function resolutionYearFromSpec(
  spec: ResolutionSpec,
  sessionResolutionYear: number,
): number {
  if (spec.kind === "metric_compare_years") {
    return spec.resolution_year;
  }
  if (spec.kind === "metric_threshold") {
    return spec.year;
  }
  return sessionResolutionYear;
}
