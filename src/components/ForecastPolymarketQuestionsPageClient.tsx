"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ForecastQuestionSourceMarket,
  PolymarketCategoryConfig,
  QuestionResolutionStatus,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

export function ForecastPolymarketQuestionsPageClient() {
  const [categories, setCategories] = useState<PolymarketCategoryConfig[]>([]);
  const [questions, setQuestions] = useState<ForecastQuestionSourceMarket[]>([]);
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [sort, setSort] = useState<"volume" | "liquidity" | "end_date">("volume");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/forecast/question-sources/polymarket/categories");
    const payload = (await response.json()) as { categories: PolymarketCategoryConfig[] };
    setCategories(payload.categories ?? []);
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category) {
      params.set("category", category);
    }
    if (status) {
      params.set("status", status);
    }
    params.set("sort", sort);
    const response = await fetch(
      `/api/forecast/question-sources/polymarket/questions?${params.toString()}`,
    );
    const payload = (await response.json()) as {
      questions: ForecastQuestionSourceMarket[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Failed to load questions");
      setQuestions([]);
    } else {
      setQuestions(payload.questions ?? []);
    }
    setLoading(false);
  }, [category, sort, status]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  async function runIngest() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/forecast/question-sources/polymarket/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ use_mock: true }),
    });
    const payload = (await response.json()) as { imported_count?: number; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Ingest failed");
      return;
    }
    setMessage(`Imported ${payload.imported_count ?? 0} Polymarket question(s) from mock fixture.`);
    await loadQuestions();
  }

  async function createSession(sourceMarketId: string) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/forecast/question-sources/polymarket/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_market_id: sourceMarketId }),
    });
    const payload = (await response.json()) as { session_id?: string; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Create session failed");
      return;
    }
    if (payload.session_id) {
      window.location.href = `/forecast/replay/${payload.session_id}`;
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Live questions</p>
              <h1 className="mt-2 text-2xl font-bold">Polymarket Question Intake</h1>
              <p className="mt-2 text-sm text-slate-400">
                Data-only intake via Polymarket Gamma API. No trading, wallets, or order placement.
              </p>
            </div>
            <ForecastNav />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-violet-700 px-3 py-1.5 text-sm"
              onClick={runIngest}
            >
              Ingest (mock fixture)
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Category</span>
              <select
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option value="">All</option>
                {categories.map((item) => (
                  <option key={item.category_id} value={item.category_id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Status</span>
              <select
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="">All</option>
                {(["open", "closed", "resolved", "unknown"] as QuestionResolutionStatus[]).map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Sort</span>
              <select
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
                onChange={(event) =>
                  setSort(event.target.value as "volume" | "liquidity" | "end_date")
                }
                value={sort}
              >
                <option value="volume">Volume</option>
                <option value="liquidity">Liquidity</option>
                <option value="end_date">Close date</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <h2 className="text-lg font-semibold">Imported questions ({questions.length})</h2>
          {loading ? <p className="mt-3 text-slate-500">Loading…</p> : null}
          <ul className="mt-3 space-y-3">
            {questions.map((question) => (
              <li
                key={question.source_market_id}
                className="rounded border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-cyan-200">{question.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {question.category} · {question.resolution_status} · p=
                      {question.implied_probability != null
                        ? `${Math.round(question.implied_probability * 100)}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      vol={question.volume?.toLocaleString() ?? "—"} · liq=
                      {question.liquidity?.toLocaleString() ?? "—"} · close=
                      {question.end_date ?? "—"}
                    </p>
                    {question.related_country_iso3_list.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        countries: {question.related_country_iso3_list.join(", ")}
                      </p>
                    ) : null}
                    {question.related_relationship_pair_list.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-400">
                        relationships: {question.related_relationship_pair_list.join(", ")}
                      </p>
                    ) : null}
                    {question.tags.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-400">tags: {question.tags.join(", ")}</p>
                    ) : null}
                    <Link
                      className="mt-2 inline-block text-xs text-violet-300 hover:text-violet-100"
                      href={question.source_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View on Polymarket
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-emerald-700 px-3 py-1 text-xs"
                    onClick={() => createSession(question.source_market_id)}
                  >
                    Create Forecast Session
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {!loading && questions.length === 0 ? (
            <p className="mt-3 text-slate-500">
              No questions indexed yet. Run mock ingest to load fixture data.
            </p>
          ) : null}
        </section>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
      </div>
    </main>
  );
}
