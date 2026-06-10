"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

export function ForecastLeaderboardPageClient() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    void fetch("/api/forecast/leaderboard")
      .then((response) => response.json())
      .then((payload: { entries: LeaderboardEntry[] }) => setEntries(payload.entries ?? []));
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold">Agent Leaderboard</h1>
              <p className="mt-2 text-sm text-slate-400">
                Ranked by average Brier score on resolved historical replays.
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <ul className="space-y-4">
            {entries.map((entry, index) => (
              <li
                key={entry.agent_id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold">
                    #{index + 1} {entry.agent_name}{" "}
                    <span className="text-sm font-normal text-slate-400">({entry.agent_type})</span>
                  </p>
                  <Link className="text-cyan-300 hover:text-cyan-100" href="/forecast/agents">
                    View agent
                  </Link>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Resolved / total</dt>
                    <dd>
                      {entry.resolved_forecasts} / {entry.total_forecasts}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Avg Brier</dt>
                    <dd>{entry.average_brier_score?.toFixed(4) ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Direction accuracy</dt>
                    <dd>
                      {entry.direction_accuracy != null
                        ? `${(entry.direction_accuracy * 100).toFixed(1)}%`
                        : "n/a"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-slate-400">
                  Best templates: {entry.best_templates.join(", ") || "n/a"} · Worst:{" "}
                  {entry.worst_templates.join(", ") || "n/a"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Source gaps: {entry.common_source_gaps.join(", ") || "none"} · Fulfilled requests:{" "}
                  {entry.fulfilled_source_requests}
                  {entry.improvement_trend ? ` · Trend: ${entry.improvement_trend}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
