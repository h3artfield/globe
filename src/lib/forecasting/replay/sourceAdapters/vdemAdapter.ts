import type { ReplaySession } from "@/types/forecasting";
import { loadCountryMetrics } from "@/lib/forecasting/replay/loadCountryMetrics";
import {
  applyComparator,
  baselineYearFromSpec,
  filterMetricsBySource,
  metricValueAtYear,
  resolutionYearFromSpec,
} from "@/lib/forecasting/replay/metricCompare";
import {
  metricRecordToEvidence,
  metricRecordToResolutionSource,
  type ReplaySourceAdapter,
} from "@/lib/forecasting/replay/sourceAdapters/types";

const SOURCE_ID = "vdem";
const METRIC_ID = "electoral_democracy_index";

function appliesToSession(session: ReplaySession): boolean {
  const spec = session.resolution_spec;
  return (
    spec.kind === "metric_compare_years" &&
    spec.source_id === "vdem" &&
    spec.metric_id === METRIC_ID
  );
}

export const vdemAdapter: ReplaySourceAdapter = {
  source_id: SOURCE_ID,

  canBuildEvidenceSnapshot(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  canResolve(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  async buildEvidenceSnapshot(session) {
    const country = session.target.target_id;
    const loaded = await loadCountryMetrics(country);
    if (!loaded) {
      return buildMissing(country);
    }

    const rows = filterMetricsBySource(loaded.metrics, "vdem", METRIC_ID);
    const cutoff = session.forecast_year;
    const included = rows.filter((row) => row.year <= cutoff);
    const excluded = rows.length - included.length;

    if (included.length === 0) {
      return {
        included_records: [],
        missing_reason: SOURCE_ID,
        excluded_future_records_count: excluded,
        source_paths: [loaded.filePath],
        confidence: "low",
        limitations: [`No V-Dem ${METRIC_ID} rows at or before ${cutoff} for ${country}.`],
      };
    }

    return {
      included_records: included.map(metricRecordToEvidence),
      missing_reason: null,
      excluded_future_records_count: excluded,
      source_paths: [loaded.filePath],
      confidence: excluded > 0 ? "medium" : "high",
      limitations: [],
    };
  },

  async resolve(session) {
    const spec = session.resolution_spec;
    if (spec.kind !== "metric_compare_years") {
      return resolveMissing("Invalid resolution spec for V-Dem adapter");
    }

    const country = session.target.target_id;
    const loaded = await loadCountryMetrics(country);
    if (!loaded) {
      return resolveMissing(`No processed metrics for ${country}`);
    }

    const rows = filterMetricsBySource(loaded.metrics, "vdem", METRIC_ID);
    const baselineYear = baselineYearFromSpec(spec, session.forecast_year);
    const resolutionYear = resolutionYearFromSpec(spec, session.resolution_year);
    const baseline = metricValueAtYear(rows, baselineYear);
    const holdout = metricValueAtYear(rows, resolutionYear);

    if (!baseline || !holdout) {
      return {
        outcome: "missing_evidence",
        resolved_value: null,
        prior_value: baseline?.value ?? null,
        comparison_value: holdout?.value ?? null,
        source_records: [baseline, holdout].filter(Boolean).map((row) =>
          metricRecordToResolutionSource(row!),
        ),
        source_paths: [loaded.filePath],
        confidence: "low",
        limitations: [
          `Missing V-Dem rows for baseline year ${baselineYear} and/or resolution year ${resolutionYear}.`,
        ],
      };
    }

    const outcome = applyComparator(holdout.value, baseline.value, spec.comparator) ? "yes" : "no";
    return {
      outcome,
      resolved_value: outcome === "yes",
      prior_value: baseline.value,
      comparison_value: holdout.value,
      source_records: [baseline, holdout].map(metricRecordToResolutionSource),
      source_paths: [loaded.filePath],
      confidence: "high",
      limitations: [],
    };
  },
};

function buildMissing(country: string) {
  return {
    included_records: [],
    missing_reason: SOURCE_ID,
    excluded_future_records_count: 0,
    source_paths: [],
    confidence: "low" as const,
    limitations: [`No processed metrics file for ${country}.`],
  };
}

function resolveMissing(message: string) {
  return {
    outcome: "missing_evidence" as const,
    resolved_value: null,
    prior_value: null,
    comparison_value: null,
    source_records: [],
    source_paths: [],
    confidence: "low" as const,
    limitations: [message],
  };
}
