import Link from "next/link";
import { notFound } from "next/navigation";
import { ForecastNav } from "@/components/ForecastNav";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ReplaySessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  const session = await loadReplaySession(sessionId);
  if (!session) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Replay session</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{session.template_id}</h1>
              <p className="mt-2 text-sm text-slate-400">
                <code>{session.session_id}</code> · {session.status} · created{" "}
                {new Date(session.created_at).toLocaleString()}
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Generated question</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300 italic">{session.question_text}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd>
                {session.target.target_type}: {session.target.target_id}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Years</dt>
              <dd>
                as_of {session.forecast_year} → resolution {session.resolution_year}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Allowed source IDs</dt>
              <dd>{session.allowed_source_ids.join(", ")}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">
            Your forecast{" "}
            <span className="text-sm font-normal text-slate-500">(placeholder — Phase 3)</span>
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Probability (0–1)
              <input
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
                readOnly
                type="text"
                value={session.user_forecast.probability ?? "—"}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Confidence (0–1)
              <input
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
                readOnly
                type="text"
                value={session.user_forecast.confidence ?? "—"}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Rationale
              <textarea
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-500"
                disabled
                readOnly
                rows={3}
                value={session.user_forecast.rationale || "Not entered yet"}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Evidence retrieval, submission, and scoring arrive in later phases.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Resolution spec (copied from template)</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
            {JSON.stringify(session.resolution_spec, null, 2)}
          </pre>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Audit trail</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {session.audit_trail.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <span className="text-slate-500">{entry.at}</span> · {entry.action}
                {entry.details ? <span className="text-slate-400"> — {entry.details}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/forecast/replay">
          Back to Historical Replay
        </Link>
      </div>
    </main>
  );
}
