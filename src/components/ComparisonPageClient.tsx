"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ForecastSourceRequest, ReplayComparisonGroup, ReplayPostmortem, ReplayScorecard, ReplaySession } from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

type ComparisonPayload = {
  group: ReplayComparisonGroup;
  sessions: Array<{
    session: ReplaySession;
    scorecard: ReplayScorecard | null;
    postmortem: ReplayPostmortem | null;
    sourceRequests: ForecastSourceRequest[];
  }>;
};

export function ComparisonPageClient({ comparisonGroupId }: { comparisonGroupId: string }) {
  const [payload, setPayload] = useState<ComparisonPayload | null>(null);

  useEffect(() => {
    void fetch(`/api/forecast/replay/comparisons/${comparisonGroupId}`)
      .then((response) => response.json())
      .then((data) => setPayload(data as ComparisonPayload));
  }, [comparisonGroupId]);

  if (!payload) {
    return <p className="p-6 text-white">Loading comparison…</p>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-300">Comparison replay</p>
              <h1 className="mt-2 text-2xl font-bold">{payload.group.template_id}</h1>
              <p className="mt-2 text-sm text-slate-400">
                {payload.group.target.target_id} · as_of {payload.group.forecast_year} →{" "}
                {payload.group.resolution_year}
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          {payload.sessions.map(({ session, scorecard, postmortem, sourceRequests }) => (
            <section
              key={session.session_id}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
            >
              <h2 className="text-lg font-semibold">
                {session.agent_name ?? "Unassigned"} ({session.agent_type ?? "n/a"})
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                p={session.user_forecast.probability ?? "—"}% · status={session.status}
              </p>
              <p className="mt-2 text-sm italic text-slate-300">
                {session.forecast_rationale || session.user_forecast.rationale || "(no rationale)"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Source requests: {sourceRequests.length} · open{" "}
                {sourceRequests.filter((request) => request.status === "open").length}
              </p>
              {scorecard ? (
                <p className="mt-2 text-sm text-emerald-300">
                  Brier {scorecard.brier_score?.toFixed(4) ?? "n/a"} · direction{" "}
                  {scorecard.direction_correct == null
                    ? "n/a"
                    : scorecard.direction_correct
                      ? "correct"
                      : "wrong"}
                </p>
              ) : null}
              {postmortem ? (
                <p className="mt-1 text-xs text-slate-400">{postmortem.score_summary}</p>
              ) : null}
              <Link
                className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-100"
                href={`/forecast/replay/${session.session_id}`}
              >
                Open session
              </Link>
            </section>
          ))}
        </div>

        <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/forecast/replay">
          Back to Historical Replay
        </Link>
      </div>
    </main>
  );
}
