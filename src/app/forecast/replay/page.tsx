import type { Metadata } from "next";
import Link from "next/link";
import { ForecastNav } from "@/components/ForecastNav";
import { ReplayTemplateCard } from "@/components/ReplayTemplateCard";
import { loadReplayTemplates } from "@/lib/forecasting/loadReplayTemplates";

export const metadata: Metadata = {
  title: "Historical Replay | Forecast Lab",
  description: "Browse Historical Replay forecast templates with as_of cutoff discipline.",
};

export default async function ForecastReplayPage() {
  const templates = await loadReplayTemplates();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Phase 1 shell</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Historical Replay
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Browse replay templates. When implemented, retrieval will only use structured metrics
                and dated events with observation date/year at or before your selected{" "}
                <code>as_of</code> cutoff.
              </p>
            </div>
            <ForecastNav />
          </div>
          <p className="mt-4 rounded-lg border border-cyan-900/60 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
            No-leak rule: replay must not use future news, RAG prose summaries, Wikipedia, top-events
            summaries, news_memory, or unconstrained embedding/chunk retrieval.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Evidence retrieval and scoring come in Phase 2/3. Controls below are placeholders.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Draft forecast{" "}
            <span className="text-sm font-normal text-slate-500">(placeholder — Phase 2/3)</span>
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            These controls are intentionally disabled. They preview the submit flow without implying
            scoring or evidence retrieval is live.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Target
              <select
                aria-disabled="true"
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
              >
                <option>Select a template first (Phase 2)</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              as_of_year
              <input
                aria-disabled="true"
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
                readOnly
                type="number"
                value={2020}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Probability (0–1)
              <input
                aria-disabled="true"
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
                max={1}
                min={0}
                readOnly
                step={0.01}
                type="number"
                value={0.5}
              />
            </label>
          </div>
          <button
            aria-disabled="true"
            className="mt-4 cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-500"
            disabled
            title="Forecast submission arrives in Phase 3"
            type="button"
          >
            Submit forecast (Phase 3 — not available)
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Replay templates ({templates.length})
            </h2>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/forecast">
              Back to Forecast Lab
            </Link>
          </div>

          {templates.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
              No templates found under <code>data/forecasting/templates/replay/</code>.
            </p>
          ) : (
            templates.map((template) => (
              <ReplayTemplateCard key={template.template_id} template={template} />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
