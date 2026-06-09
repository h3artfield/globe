"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ReplayJudgeAudit,
  ReplayPostmortem,
  ReplayScorecard,
  ReplaySession,
} from "@/types/forecasting";

type ReplaySessionScoringProps = {
  session: ReplaySession;
  initialScorecard: ReplayScorecard | null;
  initialAudit: ReplayJudgeAudit | null;
  initialPostmortem: ReplayPostmortem | null;
};

function statusBadgeClass(status: string): string {
  if (status === "pass") {
    return "border-emerald-700 text-emerald-200";
  }
  if (status === "warning") {
    return "border-amber-700 text-amber-200";
  }
  return "border-rose-700 text-rose-200";
}

export function ReplaySessionScoring({
  session,
  initialScorecard,
  initialAudit,
  initialPostmortem,
}: ReplaySessionScoringProps) {
  const router = useRouter();
  const [scorecard, setScorecard] = useState<ReplayScorecard | null>(initialScorecard);
  const [audit, setAudit] = useState<ReplayJudgeAudit | null>(initialAudit);
  const [postmortem, setPostmortem] = useState<ReplayPostmortem | null>(initialPostmortem);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [isGeneratingPostmortem, setIsGeneratingPostmortem] = useState(false);

  const canScore = session.status === "resolved";
  const canPostmortem = canScore && scorecard != null;

  async function handleScore() {
    setError(null);
    setMessage(null);
    setIsScoring(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/score`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to score session");
      }
      setScorecard(payload as ReplayScorecard);
      setMessage("Scorecard created.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to score session");
    } finally {
      setIsScoring(false);
    }
  }

  async function handleJudge() {
    setError(null);
    setMessage(null);
    setIsJudging(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/judge`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to run judge audit");
      }
      setAudit(payload as ReplayJudgeAudit);
      setMessage("Judge audit complete.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to run judge audit");
    } finally {
      setIsJudging(false);
    }
  }

  async function handlePostmortem() {
    setError(null);
    setMessage(null);
    setIsGeneratingPostmortem(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/postmortem`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate postmortem");
      }
      setPostmortem(payload as ReplayPostmortem);
      setMessage("Postmortem generated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to generate postmortem");
    } finally {
      setIsGeneratingPostmortem(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Scorecard</h2>
            <p className="mt-1 text-sm text-slate-400">
              Brier score and direction check for resolved sessions.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-sm text-violet-100 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canScore || isScoring}
            onClick={handleScore}
          >
            {isScoring ? "Scoring…" : "Run Score"}
          </button>
        </div>

        {!canScore ? (
          <p className="mt-3 text-sm text-slate-500">
            Resolve the session before scoring. Draft and locked sessions cannot be scored.
          </p>
        ) : null}

        {scorecard ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Brier score</dt>
              <dd>{scorecard.brier_score?.toFixed(4) ?? "n/a"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Direction correct</dt>
              <dd>
                {scorecard.direction_correct === null
                  ? "n/a"
                  : scorecard.direction_correct
                    ? "yes"
                    : "no"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Forecast probability</dt>
              <dd>{scorecard.forecast_probability}%</dd>
            </div>
            <div>
              <dt className="text-slate-500">Outcome</dt>
              <dd>{scorecard.outcome}</dd>
            </div>
            {scorecard.limitations ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Limitations</dt>
                <dd className="text-slate-400">{scorecard.limitations}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No scorecard yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Judge audit</h2>
            <p className="mt-1 text-sm text-slate-400">
              Leakage, source, resolution, and scoring checks.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-amber-700 bg-amber-950/50 px-4 py-2 text-sm text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isJudging}
            onClick={handleJudge}
          >
            {isJudging ? "Running…" : "Run Judge"}
          </button>
        </div>

        {audit ? (
          <div className="mt-4 space-y-3 text-sm">
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(audit.overall_status)}`}
            >
              overall: {audit.overall_status}
            </span>
            <ul className="space-y-2 text-slate-300">
              {audit.checks.map((check) => (
                <li
                  key={check.name}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                >
                  <span className={`text-xs ${statusBadgeClass(check.status)} rounded border px-1.5 py-0.5`}>
                    {check.status}
                  </span>{" "}
                  <span className="font-medium">{check.name}</span>: {check.message}
                </li>
              ))}
            </ul>
            {audit.warnings.length > 0 ? (
              <div>
                <p className="text-amber-300">Warnings</p>
                <ul className="mt-1 list-disc pl-5 text-slate-400">
                  {audit.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {audit.errors.length > 0 ? (
              <div>
                <p className="text-rose-300">Errors</p>
                <ul className="mt-1 list-disc pl-5 text-slate-400">
                  {audit.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No judge audit yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Postmortem</h2>
            <p className="mt-1 text-sm text-slate-400">
              Readable debrief after scoring.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canPostmortem || isGeneratingPostmortem}
            onClick={handlePostmortem}
          >
            {isGeneratingPostmortem ? "Generating…" : "Generate Postmortem"}
          </button>
        </div>

        {!canPostmortem ? (
          <p className="mt-3 text-sm text-slate-500">
            Run score first; postmortem requires a scorecard.
          </p>
        ) : null}

        {postmortem ? (
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <p className="italic text-slate-400">{postmortem.question_text}</p>
            <p>{postmortem.forecast_summary}</p>
            <p>{postmortem.resolution_summary}</p>
            <p>{postmortem.score_summary}</p>
            <div>
              <p className="font-medium text-emerald-300">What went right</p>
              <ul className="mt-1 list-disc pl-5">
                {postmortem.what_went_right.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-rose-300">What went wrong</p>
              <ul className="mt-1 list-disc pl-5">
                {postmortem.what_went_wrong.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-amber-300">Next time</p>
              <ul className="mt-1 list-disc pl-5">
                {postmortem.next_time_rules.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No postmortem yet.</p>
        )}
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
    </div>
  );
}
