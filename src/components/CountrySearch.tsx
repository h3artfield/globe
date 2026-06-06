"use client";

import { useMemo, useState } from "react";
import type { CountrySummary } from "@/types/country";

type CountrySearchProps = {
  countries: CountrySummary[];
  selectedCountryCodes: string[];
  onSelectCountry: (country: CountrySummary) => void;
};

export function CountrySearch({
  countries,
  selectedCountryCodes,
  onSelectCountry,
}: CountrySearchProps) {
  const [query, setQuery] = useState("");
  const selectedCodes = useMemo(() => new Set(selectedCountryCodes), [selectedCountryCodes]);
  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return countries.slice(0, 8);
    }

    return countries
      .filter(
        (country) =>
          country.name.toLowerCase().includes(normalizedQuery) ||
          country.code.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [countries, query]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Search</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:ring-2"
        placeholder="Find a country by name or ISO3..."
      />
      <div className="mt-3 space-y-2">
        {filteredCountries.map((country) => {
          const isSelected = selectedCodes.has(country.code);

          return (
            <button
              key={country.code}
              type="button"
              onClick={() => onSelectCountry(country)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-sm hover:border-cyan-500/60"
            >
              <span>
                <span className="font-medium text-slate-100">{country.name}</span>
                <span className="ml-2 text-slate-500">{country.code}</span>
              </span>
              <span className={country.hasCountryRag ? "text-emerald-300" : "text-slate-500"}>
                {isSelected ? "Selected" : country.hasCountryRag ? "RAG" : "No RAG"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
