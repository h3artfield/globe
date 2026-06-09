import type { Metadata } from "next";
import Link from "next/link";
import { ForecastNav } from "@/components/ForecastNav";

export const metadata: Metadata = {
  title: "Forecast Lab | 3D Country RAG Globe",
  description:
    "Probabilistic forecasting sandbox and Historical Replay mode for evidence-based forecast practice.",
};

export default function ForecastHubPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Probabilistic forecasting sandbox
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Build and test a forecasting machine — not a prophecy engine. You run a geopolitical
                forecasting agency: gather cutoff-safe evidence, submit calibrated probabilities, and
                compare to resolved outcomes in replay.
              </p>
            </div>
            <ForecastNav />
          </div>
          <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            This app does <strong className="font-medium">not</strong> predict the future. It is an
            evidence-based forecast replay trainer with local structured data only.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight text-white">Historical Replay Mode</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Choose a country or relationship, set an <code>as_of</code> cutoff, and forecast an outcome
            already known in later historical data. Replay will only use structured evidence available
            at or before that cutoff — never future news, RAG summaries, or unconstrained chunk
            retrieval.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Phase 1 provides template browsing and placeholder controls. Evidence retrieval arrives in
            Phase 2; submission, leakage audit, resolution reveal, and Brier scoring in Phase 3.
          </p>
          <Link
            className="mt-4 inline-flex rounded-lg border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40"
            href="/forecast/replay"
          >
            Open Historical Replay
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight text-white">Coming later</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>
              <span className="text-slate-400">Live Mode</span> — real future forecasts with open
              resolution (not built)
            </li>
            <li>
              <span className="text-slate-400">Short-Cycle Operational Mode</span> — hours/days/weeks
              resolution with curated news (not built)
            </li>
            <li>
              <span className="text-slate-400">Agent harness</span> — Data Analyst, Red Team, Judge
              roles (design only)
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
