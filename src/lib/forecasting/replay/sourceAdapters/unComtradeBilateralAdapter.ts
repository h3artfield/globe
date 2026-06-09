import type { ReplaySession } from "@/types/forecasting";
import { loadCountryMetrics } from "@/lib/forecasting/replay/loadCountryMetrics";
import {
  applyComparator,
  baselineYearFromSpec,
  bilateralTradeTotalAtYear,
  filterBilateralMetrics,
  resolutionYearFromSpec,
} from "@/lib/forecasting/replay/metricCompare";
import {
  metricRecordToEvidence,
  metricRecordToResolutionSource,
  type ReplaySourceAdapter,
  type ReplaySourceAdapterBuildResult,
  type ReplaySourceAdapterResolveResult,
} from "@/lib/forecasting/replay/sourceAdapters/types";

function reporterCountryFromRelationship(relationshipId: string): string {
  return relationshipId.split("_")[0] ?? relationshipId;
}

export const unComtradeBilateralAdapter: ReplaySourceAdapter = {
  source_id: "un_comtrade_bilateral",

  canBuildEvidenceSnapshot(session: ReplaySession): boolean {
    return (
      session.resolution_spec.kind === "metric_compare_years" &&
      session.resolution_spec.source_id === "un_comtrade" &&
      session.resolution_spec.aggregate === "sum_imports_exports"
    );
  },

  canResolve(session: ReplaySession): boolean {
    return this.canBuildEvidenceSnapshot(session);
  },

  async buildEvidenceSnapshot(session: ReplaySession): Promise<ReplaySourceAdapterBuildResult> {
    const spec = session.resolution_spec;
    if (spec.kind !== "metric_compare_years" || !spec.relationship_id) {
      return emptyMissing("Resolution spec is not bilateral trade compare");
    }

    const reporter = reporterCountryFromRelationship(spec.relationship_id);
    const loaded = await loadCountryMetrics(reporter);
    if (!loaded) {
      return emptyMissing(`No processed metrics file for ${reporter}`);
    }

    const bilateral = filterBilateralMetrics(loaded.metrics, spec.relationship_id);
    const cutoff = session.forecast_year;
    const included = bilateral.filter((row) => row.year <= cutoff);
    const excluded = bilateral.length - included.length;

    if (included.length === 0) {
      return {
        included_records: [],
        missing_reason: `un_comtrade_bilateral`,
        excluded_future_records_count: excluded,
        source_paths: [loaded.filePath],
        confidence: "low",
        limitations: [
          `No bilateral trade rows at or before as_of year ${cutoff} for ${spec.relationship_id}.`,
        ],
      };
    }

    return {
      included_records: included.map(metricRecordToEvidence),
      missing_reason: null,
      excluded_future_records_count: excluded,
      source_paths: [loaded.filePath],
      confidence: excluded > 0 ? "medium" : "high",
      limitations: [
        "Evidence includes bilateral import/export rows only; totals are not pre-aggregated in snapshot.",
      ],
    };
  },

  async resolve(session: ReplaySession): Promise<ReplaySourceAdapterResolveResult> {
    const spec = session.resolution_spec;
    if (spec.kind !== "metric_compare_years" || !spec.relationship_id) {
      return missingResolution("Resolution spec is not bilateral trade compare");
    }

    const reporter = reporterCountryFromRelationship(spec.relationship_id);
    const loaded = await loadCountryMetrics(reporter);
    if (!loaded) {
      return missingResolution(`No processed metrics file for ${reporter}`);
    }

    const baselineYear = baselineYearFromSpec(spec, session.forecast_year);
    const resolutionYear = resolutionYearFromSpec(spec, session.resolution_year);
    const baseline = bilateralTradeTotalAtYear(loaded.metrics, spec.relationship_id, baselineYear);
    const holdout = bilateralTradeTotalAtYear(loaded.metrics, spec.relationship_id, resolutionYear);

    if (!baseline || !holdout) {
      return {
        outcome: "missing_evidence",
        resolved_value: null,
        prior_value: baseline?.total ?? null,
        comparison_value: holdout?.total ?? null,
        source_records: [...(baseline?.rows ?? []), ...(holdout?.rows ?? [])].map(
          metricRecordToResolutionSource,
        ),
        source_paths: [loaded.filePath],
        confidence: "low",
        limitations: [
          `Missing bilateral trade totals for baseline year ${baselineYear} and/or resolution year ${resolutionYear}.`,
        ],
      };
    }

    const outcome = applyComparator(holdout.total, baseline.total, spec.comparator) ? "yes" : "no";
    return {
      outcome,
      resolved_value: outcome === "yes",
      prior_value: baseline.total,
      comparison_value: holdout.total,
      source_records: [...baseline.rows, ...holdout.rows].map(metricRecordToResolutionSource),
      source_paths: [loaded.filePath],
      confidence: "high",
      limitations: [],
    };
  },
};

function emptyMissing(reason: string): ReplaySourceAdapterBuildResult {
  return {
    included_records: [],
    missing_reason: reason,
    excluded_future_records_count: 0,
    source_paths: [],
    confidence: "low",
    limitations: [reason],
  };
}

function missingResolution(message: string): ReplaySourceAdapterResolveResult {
  return {
    outcome: "missing_evidence",
    resolved_value: null,
    prior_value: null,
    comparison_value: null,
    source_records: [],
    source_paths: [],
    confidence: "low",
    limitations: [message],
  };
}
