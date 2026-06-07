"use client";

import { useState } from "react";
import type { CountrySummary } from "@/types/country";
import type { RagStatusResponse } from "@/types/api";

const TABS = ["Overview", "Coverage", "Scorecard", "Allies", "Adversaries", "Top Events", "Timeline", "Sources"];

type SelectedCountriesPanelProps = {
  selectedCountries: CountrySummary[];
  ragStatus: RagStatusResponse | null;
  onRemoveCountry: (countryCode: string) => void;
};

export function SelectedCountriesPanel({
  selectedCountries,
  ragStatus,
  onRemoveCountry,
}: SelectedCountriesPanelProps) {
  const [activeTab, setActiveTab] = useState("Overview");
  const countryStatusByCode = new Map(
    ragStatus?.countries.map((country) => [country.code, country]) ?? [],
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected</p>
          <h2 className="text-lg font-semibold text-white">Countries</h2>
        </div>
        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-sm text-cyan-200">
          {selectedCountries.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-full bg-cyan-500 px-2 py-1 text-[11px] font-semibold text-slate-950"
                : "rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-100"
            }
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab !== "Overview" ? (
        <p className="mt-3 rounded-lg bg-slate-900/70 p-2 text-xs text-slate-400">
          {activeTab} data is loaded from the corresponding country RAG/world-model files when
          available. Missing files are shown as coverage or review-queue gaps.
        </p>
      ) : null}

      {selectedCountries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">Click countries on the globe to build context.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {selectedCountries.map((country) => {
            const countryStatus = countryStatusByCode.get(country.code);

            return (
              <div
                key={country.code}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{countryStatus?.name ?? country.name}</p>
                    <p className="text-sm text-slate-400">{country.code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCountry(country.code)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-400 hover:text-red-200"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 text-xs">
                  <span
                    className={
                      countryStatus?.hasCountryRag
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }
                  >
                    {countryStatus?.hasCountryRag ? "Country RAG found" : "Country RAG missing"}
                  </span>
                  {countryStatus?.countryProfilePath ? (
                    <p className="mt-1 break-all text-slate-500">
                      {countryStatus.countryProfilePath}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ragStatus && ragStatus.relationships.length > 0 ? (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Relationships</p>
          <div className="mt-3 space-y-2">
            {ragStatus.relationships.map((relationship) => (
              <div
                key={relationship.relationshipId}
                className="rounded-lg bg-slate-900/70 p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-200">{relationship.relationshipId}</span>
                  <span
                    className={
                      relationship.hasRelationshipRag ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {relationship.hasRelationshipRag ? "RAG found" : "Missing"}
                  </span>
                </div>
                <p className="mt-1 break-all text-slate-500">
                  {relationship.relationshipProfilePath}
                </p>
                <p className="mt-2 text-slate-500">
                  World model: alignment, hostility, top relationship events, crisis history,
                  war history, and trade dependency are exposed through relationship modules as
                  verified data becomes available.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
