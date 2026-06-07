"use client";

import { useEffect, useState } from "react";
import type { RagStatusResponse } from "@/types/api";
import type { CountrySummary } from "@/types/country";
import type { PilotCompletionScore, PilotReadinessReport, SourceGapReport } from "@/types/pilot";
import type { CountryModule, CoverageReport, RelationshipCoverageReport } from "@/types/pipeline";
import { LoadingState } from "./LoadingState";

type CoveragePanelProps = {
  selectedCountries: CountrySummary[];
  ragStatus: RagStatusResponse | null;
};

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value === null ? "n/a" : `${value}%`}</p>
    </div>
  );
}

export function CoveragePanel({ selectedCountries, ragStatus }: CoveragePanelProps) {
  const [countryCoverage, setCountryCoverage] = useState<CoverageReport[]>([]);
  const [relationshipCoverage, setRelationshipCoverage] = useState<RelationshipCoverageReport[]>([]);
  const [countryModules, setCountryModules] = useState<Record<string, CountryModule[]>>({});
  const [completionScores, setCompletionScores] = useState<Record<string, PilotCompletionScore>>({});
  const [readinessReports, setReadinessReports] = useState<Record<string, PilotReadinessReport>>({});
  const [sourceGapReports, setSourceGapReports] = useState<Record<string, SourceGapReport>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadCoverage() {
      if (selectedCountries.length === 0) {
        setCountryCoverage([]);
        setRelationshipCoverage([]);
        return;
      }

      setIsLoading(true);

      try {
        const countries = await Promise.all(
          selectedCountries.map(async (country) => {
            const response = await fetch(`/api/country/${country.code}/coverage`);
            return response.ok ? ((await response.json()) as CoverageReport) : null;
          }),
        );
        const modulePayloads = await Promise.all(
          selectedCountries.map(async (country) => {
            const response = await fetch(`/api/country/${country.code}/modules`);
            return response.ok
              ? [country.code, ((await response.json()) as { modules: CountryModule[] }).modules] as const
              : [country.code, []] as const;
          }),
        );
        const completionPayloads = await Promise.all(
          selectedCountries.map(async (country) => {
            const response = await fetch(`/api/pilot/country/${country.code}/completion`);
            return response.ok
              ? [country.code, (await response.json()) as PilotCompletionScore] as const
              : null;
          }),
        );
        const readinessPayloads = await Promise.all(
          selectedCountries.map(async (country) => {
            const response = await fetch(`/api/pilot/country/${country.code}/readiness`);
            return response.ok ? [country.code, (await response.json()) as PilotReadinessReport] as const : null;
          }),
        );
        const gapPayloads = await Promise.all(
          selectedCountries.map(async (country) => {
            const response = await fetch(`/api/source-gaps/country/${country.code}`);
            return response.ok ? [country.code, (await response.json()) as SourceGapReport] as const : null;
          }),
        );
        const relationships = await Promise.all(
          (ragStatus?.relationships ?? []).map(async (relationship) => {
            const response = await fetch(
              `/api/relationship/${relationship.relationshipId}/coverage`,
            );
            return response.ok ? ((await response.json()) as RelationshipCoverageReport) : null;
          }),
        );

        if (isCancelled) {
          return;
        }

        setCountryCoverage(
          countries.filter((coverage): coverage is CoverageReport => coverage !== null),
        );
        setRelationshipCoverage(
          relationships.filter(
            (coverage): coverage is RelationshipCoverageReport => coverage !== null,
          ),
        );
        setCountryModules(Object.fromEntries(modulePayloads));
        setCompletionScores(Object.fromEntries(completionPayloads.filter((item): item is readonly [string, PilotCompletionScore] => item !== null)));
        setReadinessReports(Object.fromEntries(readinessPayloads.filter((item): item is readonly [string, PilotReadinessReport] => item !== null)));
        setSourceGapReports(Object.fromEntries(gapPayloads.filter((item): item is readonly [string, SourceGapReport] => item !== null)));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadCoverage();

    return () => {
      isCancelled = true;
    };
  }, [selectedCountries, ragStatus]);

  if (selectedCountries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Coverage</p>
          <h2 className="text-lg font-semibold text-white">RAG status</h2>
        </div>
        {isLoading ? <LoadingState label="Loading coverage" /> : null}
      </div>

      <div className="mt-4 space-y-4">
        {countryCoverage.map((coverage) => (
          <div key={coverage.country_code} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-100">{coverage.country_code}</p>
              <span className="text-xs text-cyan-300">RAG {coverage.coverage_score ?? 0}%</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ScoreBadge label="Structured" value={coverage.structured_data_score} />
              <ScoreBadge label="Narrative" value={coverage.narrative_data_score} />
              <ScoreBadge label="Freshness" value={coverage.freshness_score} />
              <ScoreBadge label="Provenance" value={coverage.provenance_score} />
              <ScoreBadge label="Pilot ready" value={completionScores[coverage.country_code]?.overall_pilot_readiness ?? null} />
              <ScoreBadge label="Retrieval" value={completionScores[coverage.country_code]?.retrieval_quality ?? null} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Missing modules: {coverage.modules_missing.slice(0, 5).join(", ") || "none"}
              {coverage.modules_missing.length > 5 ? "..." : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Outdated metrics: {coverage.outdated_metrics.join(", ") || "none"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Pending review items: {coverage.review_queue_items.length}
            </p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs">
              <p className="font-semibold text-slate-200">Evidence Quality</p>
              <p className="mt-1 text-slate-400">
                Source readiness: {Math.round((sourceGapReports[coverage.country_code]?.overall_source_readiness ?? 0) * 100)}%
              </p>
              <p className="text-slate-400">Citation quality: {completionScores[coverage.country_code]?.citation_quality ?? 0}%</p>
              <p className="text-slate-400">Review quality: {completionScores[coverage.country_code]?.review_quality ?? 0}%</p>
              <p className="text-slate-400">Pilot readiness: {Math.round((readinessReports[coverage.country_code]?.overall_score ?? 0) * 100)}%</p>
              <p className="mt-1 text-amber-300">
                Weak areas: {(readinessReports[coverage.country_code]?.failed_gates ?? []).slice(0, 4).join(", ") || "none"}
              </p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {(countryModules[coverage.country_code] ?? []).slice(0, 8).map((module) => (
                <div key={module.module} className="flex items-center justify-between gap-2 rounded bg-slate-950/60 px-2 py-1">
                  <span className="text-slate-300">{module.module}</span>
                  <span className="text-slate-500">
                    {module.review_status ?? module.generation_status ?? "human_review_pending"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-1 text-xs">
              {coverage.source_family_coverage.slice(0, 9).map((source) => (
                <div key={source.source_id} className="flex items-center justify-between gap-2 rounded bg-slate-950/60 px-2 py-1">
                  <span className="text-slate-300">{source.source_id}</span>
                  <span
                    className={
                      source.status === "available"
                        ? "text-emerald-300"
                        : source.status === "partial"
                          ? "text-cyan-300"
                          : "text-amber-300"
                    }
                  >
                    {source.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {relationshipCoverage.length > 0 ? (
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Relationship coverage</p>
            <div className="mt-2 space-y-2">
              {relationshipCoverage.map((coverage) => (
                <div key={coverage.relationship_id} className="rounded-lg bg-slate-900/70 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{coverage.relationship_id}</span>
                    <span className="text-cyan-300">{coverage.coverage_score ?? 0}%</span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    Missing: {coverage.modules_missing.join(", ") || "none"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
