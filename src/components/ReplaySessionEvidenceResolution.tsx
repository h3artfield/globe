"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ReplayEvidenceSnapshot,
  ReplayResolution,
  ReplaySession,
} from "@/types/forecasting";

type ReplaySessionEvidenceResolutionProps = {
  session: ReplaySession;
  initialSnapshot: ReplayEvidenceSnapshot | null;
  initialResolution: ReplayResolution | null;
};

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "high") {
    return "border-emerald-700 text-emerald-200";
  }
  if (confidence === "medium") {
    return "border-amber-700 text-amber-200";
  }
  return "border-rose-700 text-rose-200";
}

export function ReplaySessionEvidenceResolution({
  session,
  initialSnapshot,
  initialResolution,
}: ReplaySessionEvidenceResolutionProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ReplayEvidenceSnapshot | null>(initialSnapshot);
  const [resolution, setResolution] = useState<ReplayResolution | null>(initialResolution);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const canGenerateSnapshot = session.status === "draft" || session.status === "locked";
  const canResolve = session.status === "locked";

  async function handleGenerateSnapshot() {
    setError(null);
    setMessage(null);
    setIsGeneratingSnapshot(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/evidence-snapshot`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to generate evidence snapshot");
      }
      setSnapshot(payload as ReplayEvidenceSnapshot);
      setMessage("Evidence snapshot generated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to generate evidence snapshot");
    } finally {
      setIsGeneratingSnapshot(false);
    }
  }

  async function handleResolve() {
    setError(null);
    setMessage(null);
    setIsResolving(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/resolve`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to resolve session");
      }
      setResolution(payload as ReplayResolution);
      setMessage("Historical resolution recorded.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to resolve session");
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Evidence snapshot</h2>
            <p className="mt-1 text-sm text-slate-400">
              Structured records available at or before as_of year {session.forecast_year}. Future
              rows are excluded.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-cyan-700 bg-cyan-950/50 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerateSnapshot || isGeneratingSnapshot}
            onClick={handleGenerateSnapshot}
          >
            {isGeneratingSnapshot ? "Generating…" : "Generate Evidence Snapshot"}
          </button>
        </div>

        {!canGenerateSnapshot ? (
          <p className="mt-3 text-sm text-slate-500">
            Evidence snapshots are available for draft or locked sessions only.
          </p>
        ) : null}

        {snapshot ? (
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${confidenceBadgeClass(snapshot.confidence)}`}
              >
                confidence: {snapshot.confidence}
              </span>
              <span className="text-slate-500">{snapshot.included_records.length} included</span>
              {snapshot.excluded_future_records_count > 0 ? (
                <span className="text-amber-300">
                  {snapshot.excluded_future_records_count} future record(s) excluded
                </span>
              ) : null}
            </div>
            <p>{snapshot.summary}</p>
            {snapshot.missing_sources.length > 0 ? (
              <p className="text-amber-200">
                Missing sources: {snapshot.missing_sources.join(", ")}
              </p>
            ) : null}
            {snapshot.limitations ? (
              <p className="text-slate-400">Limitations: {snapshot.limitations}</p>
            ) : null}
            {snapshot.source_paths.length > 0 ? (
              <p className="text-slate-500">Sources: {snapshot.source_paths.join(", ")}</p>
            ) : null}
            {snapshot.included_records.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                {snapshot.included_records.slice(0, 20).map((record) => (
                  <li key={record.record_id}>
                    {record.label}: {record.value_summary}
                  </li>
                ))}
                {snapshot.included_records.length > 20 ? (
                  <li className="text-slate-500">
                    …and {snapshot.included_records.length - 20} more
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No evidence snapshot yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Historical resolution</h2>
            <p className="mt-1 text-sm text-slate-400">
              Resolve from local holdout data after the forecast is locked.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canResolve || isResolving}
            onClick={handleResolve}
          >
            {isResolving ? "Resolving…" : "Resolve"}
          </button>
        </div>

        {!canResolve ? (
          <p className="mt-3 text-sm text-slate-500">
            Lock the forecast before resolving. Draft sessions cannot be resolved.
          </p>
        ) : null}

        {resolution ? (
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-700 px-2 py-0.5 text-xs text-emerald-200">
                outcome: {resolution.outcome}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${confidenceBadgeClass(resolution.confidence)}`}
              >
                confidence: {resolution.confidence}
              </span>
            </div>
            {resolution.prior_value != null ? (
              <p>Prior value: {String(resolution.prior_value)}</p>
            ) : null}
            {resolution.comparison_value != null ? (
              <p>Comparison value: {String(resolution.comparison_value)}</p>
            ) : null}
            {resolution.resolved_value != null ? (
              <p>Resolved value: {String(resolution.resolved_value)}</p>
            ) : null}
            {resolution.limitations ? (
              <p className="text-slate-400">Limitations: {resolution.limitations}</p>
            ) : null}
            {resolution.source_records.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                {resolution.source_records.map((record) => (
                  <li key={record.record_id}>
                    {record.label}: {record.value_summary}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Not resolved yet.</p>
        )}
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
    </div>
  );
}
