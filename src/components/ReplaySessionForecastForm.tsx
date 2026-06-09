"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReplayForecastConfidence, ReplaySession } from "@/types/forecasting";

type ReplaySessionForecastFormProps = {
  session: ReplaySession;
};

const CONFIDENCE_OPTIONS: Array<{ value: ReplayForecastConfidence | ""; label: string }> = [
  { value: "", label: "Not set" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function ReplaySessionForecastForm({ session }: ReplaySessionForecastFormProps) {
  const router = useRouter();
  const isEditable = session.status === "draft";
  const [probability, setProbability] = useState<string>(
    session.user_forecast.probability?.toString() ?? "",
  );
  const [confidence, setConfidence] = useState<ReplayForecastConfidence | "">(
    session.user_forecast.confidence ?? "",
  );
  const [rationale, setRationale] = useState(session.user_forecast.rationale);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  async function saveDraft() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/forecast/replay/sessions/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          probability: probability === "" ? null : Number(probability),
          confidence: confidence === "" ? null : confidence,
          rationale,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Save failed (${response.status})`);
      }
      setMessage("Draft saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  }

  async function lockForecast() {
    setIsLocking(true);
    setError(null);
    setMessage(null);

    try {
      const saveResponse = await fetch(`/api/forecast/replay/sessions/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          probability: probability === "" ? null : Number(probability),
          confidence: confidence === "" ? null : confidence,
          rationale,
        }),
      });
      if (!saveResponse.ok) {
        const payload = (await saveResponse.json()) as { error?: string };
        throw new Error(payload.error ?? `Save failed (${saveResponse.status})`);
      }

      const lockResponse = await fetch(`/api/forecast/replay/sessions/${session.session_id}/lock`, {
        method: "POST",
      });
      const payload = (await lockResponse.json()) as { error?: string };
      if (!lockResponse.ok) {
        throw new Error(payload.error ?? `Lock failed (${lockResponse.status})`);
      }

      router.refresh();
    } catch (lockError) {
      setError(lockError instanceof Error ? lockError.message : "Failed to lock forecast.");
    } finally {
      setIsLocking(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">Your forecast</h2>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
          {session.status}
        </span>
      </div>

      {!isEditable ? (
        <p className="mt-2 text-xs text-slate-500">
          This forecast is read-only because the session is {session.status}.
          {session.locked_at ? ` Locked at ${new Date(session.locked_at).toLocaleString()}.` : ""}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Probability (0–100)
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={!isEditable}
            max={100}
            min={0}
            onChange={(event) => setProbability(event.target.value)}
            step={1}
            type="number"
            value={probability}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Confidence
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={!isEditable}
            onChange={(event) =>
              setConfidence(event.target.value as ReplayForecastConfidence | "")
            }
            value={confidence}
          >
            {CONFIDENCE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-300 sm:col-span-2">
          Rationale
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={!isEditable}
            onChange={(event) => setRationale(event.target.value)}
            rows={4}
            value={rationale}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      {isEditable ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isLocking}
            onClick={saveDraft}
            type="button"
          >
            {isSaving ? "Saving…" : "Save Draft"}
          </button>
          <button
            className="rounded-lg border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isLocking || probability === ""}
            onClick={lockForecast}
            type="button"
          >
            {isLocking ? "Locking…" : "Lock Forecast"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
