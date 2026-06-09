"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnswerPanel } from "@/components/AnswerPanel";
import { AskPanel } from "@/components/AskPanel";
import { CountryInfoPanel } from "@/components/CountryInfoPanel";
import { CountrySearch } from "@/components/CountrySearch";
import { CoveragePanel } from "@/components/CoveragePanel";
import { Globe } from "@/components/Globe";
import { LoadingState } from "@/components/LoadingState";
import { SelectedCountriesPanel } from "@/components/SelectedCountriesPanel";
import { removeCountrySelection, toggleCountrySelection } from "@/lib/globe/countrySelection";
import type { AskResponse, RagStatusResponse } from "@/types/api";
import type { CountrySummary } from "@/types/country";

export default function Home() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<CountrySummary[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<CountrySummary | null>(null);
  const [ragStatus, setRagStatus] = useState<RagStatusResponse | null>(null);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCountries() {
      try {
        const response = await fetch("/api/countries");

        if (!response.ok) {
          throw new Error(`Failed to load countries: ${response.status}`);
        }

        const data = (await response.json()) as CountrySummary[];

        if (isMounted) {
          setCountries(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load countries.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingCountries(false);
        }
      }
    }

    loadCountries();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const selectedCodes = selectedCountries.map((country) => country.code);

    if (selectedCodes.length === 0) {
      return;
    }

    const controller = new AbortController();

    async function loadRagStatus() {
      setIsLoadingStatus(true);

      try {
        const response = await fetch("/api/rag-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ selectedCountries: selectedCodes }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load RAG status: ${response.status}`);
        }

        const data = (await response.json()) as RagStatusResponse;
        setRagStatus(data);
      } catch (statusError) {
        if (!controller.signal.aborted) {
          setError(
            statusError instanceof Error ? statusError.message : "Failed to load RAG status.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingStatus(false);
        }
      }
    }

    loadRagStatus();

    return () => {
      controller.abort();
    };
  }, [selectedCountries]);

  const handleToggleCountry = useCallback((country: CountrySummary) => {
    const nextCountries = toggleCountrySelection(selectedCountries, country);
    setSelectedCountries(nextCountries);
    if (nextCountries.length === 0) {
      setRagStatus(null);
      setIsLoadingStatus(false);
    }
    setAnswer(null);
    setError(null);
  }, [selectedCountries]);

  const handleRemoveCountry = useCallback((countryCode: string) => {
    const nextCountries = removeCountrySelection(selectedCountries, countryCode);
    setSelectedCountries(nextCountries);
    if (nextCountries.length === 0) {
      setRagStatus(null);
      setIsLoadingStatus(false);
    }
    setAnswer(null);
  }, [selectedCountries]);

  const handleAsk = useCallback(
    async (question: string) => {
      setIsAsking(true);
      setError(null);

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
            selectedCountries: selectedCountries.map((country) => country.code),
            mode: "strategic",
          }),
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? `Ask request failed: ${response.status}`);
        }

        const data = (await response.json()) as AskResponse;
        setAnswer(data);
      } catch (askError) {
        setError(askError instanceof Error ? askError.message : "Failed to ask question.");
      } finally {
        setIsAsking(false);
      }
    },
    [selectedCountries],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
            Local structured RAG MVP
          </p>
          <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                3D Country RAG Globe
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Select countries, inspect local RAG coverage, and ask strategic questions grounded
                in country and relationship JSON files under <code>/data/rag</code>.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-400 sm:items-end">
              <nav className="flex flex-wrap gap-3">
                <Link className="text-cyan-300 hover:text-cyan-100" href="/about">
                  About &amp; KB Status
                </Link>
                <Link className="text-cyan-300 hover:text-cyan-100" href="/review">
                  Review
                </Link>
              </nav>
              {isLoadingCountries ? (
                <LoadingState label="Loading countries" />
              ) : (
                `${countries.length} countries loaded`
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Globe
            selectedCountries={selectedCountries}
            onToggleCountry={handleToggleCountry}
            onHoverCountry={setHoveredCountry}
          />

          <aside className="space-y-4">
            <CountryInfoPanel hoveredCountry={hoveredCountry} />
            <CountrySearch
              countries={countries}
              selectedCountryCodes={selectedCountries.map((country) => country.code)}
              onSelectCountry={handleToggleCountry}
            />
            {isLoadingStatus ? <LoadingState label="Checking RAG files" /> : null}
            <SelectedCountriesPanel
              selectedCountries={selectedCountries}
              ragStatus={selectedCountries.length > 0 ? ragStatus : null}
              onRemoveCountry={handleRemoveCountry}
            />
            <CoveragePanel
              selectedCountries={selectedCountries}
              ragStatus={selectedCountries.length > 0 ? ragStatus : null}
            />
            <AskPanel
              disabled={selectedCountries.length === 0}
              isLoading={isAsking}
              onAsk={handleAsk}
            />
            <AnswerPanel answer={answer} error={error} />
          </aside>
        </div>
      </div>
    </main>
  );
}
