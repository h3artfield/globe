import Link from "next/link";
import type { ReplaySession } from "@/types/forecasting";

type ReplaySessionListProps = {
  sessions: ReplaySession[];
};

export function ReplaySessionList({ sessions }: ReplaySessionListProps) {
  if (sessions.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight text-white">Saved sessions</h2>
        <p className="mt-2 text-sm text-slate-400">No replay sessions yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        Saved sessions ({sessions.length})
      </h2>
      <ul className="mt-4 space-y-3">
        {sessions.map((session) => (
          <li
            key={session.session_id}
            className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-100">{session.template_id}</p>
                <p className="text-slate-400">
                  {session.target.target_id} · as_of {session.forecast_year} → {session.resolution_year}
                  {session.user_forecast.probability !== null
                    ? ` · p=${session.user_forecast.probability}%`
                    : ""}
                </p>
              </div>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                {session.status}
              </span>
            </div>
            <Link
              className="mt-2 inline-block text-cyan-300 hover:text-cyan-100"
              href={`/forecast/replay/${session.session_id}`}
            >
              Open session
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
