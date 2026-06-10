"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionEvidenceAssessment, ReplaySession } from "@/types/forecasting";

type ReplaySessionEvidenceQualityProps = {
  session: ReplaySession;
  initialAssessment: SessionEvidenceAssessment | null;
};

function recommendationBadgeClass(recommendation: string): string {
  if (recommendation === "forecast_now") {
    return "border-emerald-700 text-emerald-200";
  }
  if (recommendation === "request_more_sources") {
    return "border-amber-700 text-amber-200";
  }
  return "border-violet-700 text-violet-200";
}

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "high") {
    return "border-emerald-700 text-emerald-200";
  }
  if (confidence === "medium") {
    return "border-amber-700 text-amber-200";
  }
  return "border-rose-700 text-rose-200";
}

function scoreBarClass(score: number): string {
  if (score >= 0.65) {
    return "bg-emerald-500";
  }
  if (score >= 0.45) {
    return "bg-amber-500";
  }
  return "bg-rose-500";
}

export function ReplaySessionEvidenceQuality({
  session,
  initialAssessment,
}: ReplaySessionEvidenceQualityProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<SessionEvidenceAssessment | null>(initialAssessment);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"assess" | "plan" | null>(null);

  const canAct = session.status === "draft" || session.status === "locked";

  async function handleAssessEvidence() {
    setError(null);
    setMessage(null);
    setLoadingAction("assess");
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/evidence-assessment`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        assessment?: SessionEvidenceAssessment;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to assess evidence");
      }
      if (payload.assessment) {
        setAssessment(payload.assessment);
      }
      setMessage("Evidence assessment saved for this session.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to assess evidence");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePlanSourceRequests() {
    setError(null);
    setMessage(null);
    setLoadingAction("plan");
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/plan-source-requests`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        created_count?: number;
        reused_count?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to plan source requests");
      }
      setMessage(
        `Planned source requests: ${payload.created_count ?? 0} created, ${payload.reused_count ?? 0} reused.`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to plan source requests");
    } finally {
      setLoadingAction(null);
    }
  }

  const scoreEntries = assessment
    ? [
        ["Relevance", assessment.scores.relevance],
        ["Recency", assessment.scores.recency],
        ["Source diversity", assessment.scores.source_diversity],
        ["Source quality", assessment.scores.source_quality],
        ["Metric coverage", assessment.scores.metric_coverage],
        ["News coverage", assessment.scores.news_coverage],
        ["Market signal", assessment.scores.market_signal_strength],
      ]
    : [];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Evidence Quality</h2>
          <p className="mt-1 text-sm text-slate-400">
            Session-level evidence ranking and source gap planning for forecast agents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-cyan-700 bg-cyan-950/50 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAct || loadingAction !== null}
            onClick={handleAssessEvidence}
          >
            {loadingAction === "assess" ? "Assessing…" : "Assess Evidence"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-sm text-violet-100 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAct || loadingAction !== null}
            onClick={handlePlanSourceRequests}
          >
            {loadingAction === "plan" ? "Planning…" : "Plan Source Requests"}
          </button>
        </div>
      </div>

      {!canAct ? (
        <p className="mt-3 text-sm text-slate-500">
          Evidence assessment is unavailable for resolved sessions.
        </p>
      ) : null}

      {assessment ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-300">
              Overall evidence score:{" "}
              <strong>{Math.round(assessment.scores.overall_evidence_score * 100)}%</strong>
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${recommendationBadgeClass(assessment.recommendation)}`}
            >
              {assessment.recommendation}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${confidenceBadgeClass(assessment.confidence_ceiling)}`}
            >
              ceiling: {assessment.confidence_ceiling}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
              domain: {assessment.question_domain}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {scoreEntries.map(([label, score]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{label}</span>
                  <span>{Math.round((score as number) * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full ${scoreBarClass(score as number)}`}
                    style={{ width: `${Math.round((score as number) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-200">Source mix</h3>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.entries(assessment.source_mix).map(([sourceId, count]) => (
                <li
                  key={sourceId}
                  className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300"
                >
                  {sourceId}: {count}
                </li>
              ))}
              {Object.keys(assessment.source_mix).length === 0 ? (
                <li className="text-slate-500">No sources represented in snapshot.</li>
              ) : null}
            </ul>
          </div>

          {assessment.missing_sources.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">Missing sources</h3>
              <p className="mt-1 text-sm text-slate-400">{assessment.missing_sources.join(", ")}</p>
            </div>
          ) : null}

          {assessment.source_gaps.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">Source gaps</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {assessment.source_gaps.map((gap) => (
                  <li
                    key={gap.gap_id}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
                  >
                    <span className="font-medium text-amber-200">{gap.missing_source_id}</span>
                    <span className="text-slate-500"> · {gap.priority}</span>
                    <p className="mt-1 text-xs text-slate-400">{gap.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {assessment.warnings.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-slate-200">Warnings</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200/90">
                {assessment.warnings.map((warning, index) => (
                  <li key={`${warning.slice(0, 24)}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No evidence assessment yet. Build an evidence snapshot, then run Assess Evidence.
        </p>
      )}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-cyan-300">{message}</p> : null}
    </section>
  );
}
