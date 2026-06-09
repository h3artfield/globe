import type { Metadata } from "next";
import Link from "next/link";
import { ForecastNav } from "@/components/ForecastNav";
import { ReplaySessionList } from "@/components/ReplaySessionList";
import { ReplaySessionStarter } from "@/components/ReplaySessionStarter";
import { ReplayTemplateCard } from "@/components/ReplayTemplateCard";
import { loadReplayTemplates } from "@/lib/forecasting/loadReplayTemplates";
import { listReplaySessions } from "@/lib/forecasting/replaySessionStore";

export const metadata: Metadata = {
  title: "Historical Replay | Forecast Lab",
  description: "Browse Historical Replay forecast templates with as_of cutoff discipline.",
};

export default async function ForecastReplayPage() {
  const [templates, sessions] = await Promise.all([loadReplayTemplates(), listReplaySessions()]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Phase 2 sessions</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Historical Replay
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Start a replay session from a template. Evidence retrieval uses only structured data
                at or before your selected <code>as_of</code> cutoff (Phase 3+).
              </p>
            </div>
            <ForecastNav />
          </div>
          <p className="mt-4 rounded-lg border border-cyan-900/60 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
            No-leak rule: replay must not use future news, RAG prose summaries, Wikipedia, top-events
            summaries, news_memory, or unconstrained embedding/chunk retrieval.
          </p>
        </header>

        <ReplaySessionStarter templates={templates} />
        <ReplaySessionList sessions={sessions} />

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
