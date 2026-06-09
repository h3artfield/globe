"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CreateSourceRequestInput,
  ForecastSourceRequest,
  ForecastSourceRequestType,
  ReplaySession,
} from "@/types/forecasting";

type ReplaySessionAgentPanelProps = {
  session: ReplaySession;
  initialSourceRequests: ForecastSourceRequest[];
};

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(values: string[]): string {
  return values.join("\n");
}

export function ReplaySessionAgentPanel({
  session,
  initialSourceRequests,
}: ReplaySessionAgentPanelProps) {
  const router = useRouter();
  const isEditable = session.status === "draft";
  const [keySignals, setKeySignals] = useState(arrayToLines(session.key_signals));
  const [assumptions, setAssumptions] = useState(arrayToLines(session.assumptions));
  const [uncertaintyNotes, setUncertaintyNotes] = useState(session.uncertainty_notes);
  const [forecastRationale, setForecastRationale] = useState(
    session.forecast_rationale || session.user_forecast.rationale,
  );
  const [sourceRequests, setSourceRequests] =
    useState<ForecastSourceRequest[]>(initialSourceRequests);
  const [requestReason, setRequestReason] = useState("");
  const [requestSourceId, setRequestSourceId] = useState(
    session.allowed_source_ids[0] ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  async function saveAgentFields() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/forecast/replay/sessions/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forecast_rationale: forecastRationale,
          rationale: forecastRationale,
          key_signals: linesToArray(keySignals),
          assumptions: linesToArray(assumptions),
          uncertainty_notes: uncertaintyNotes,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Save failed");
      }
      setMessage("Agent rationale fields saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function createSourceRequest(requestType: ForecastSourceRequestType) {
    if (!requestReason.trim()) {
      setError("Provide a reason for the source request.");
      return;
    }
    setIsRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const body: CreateSourceRequestInput = {
        request_type: requestType,
        requested_source_id: requestSourceId,
        reason: requestReason,
      };
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/source-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as ForecastSourceRequest & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      setSourceRequests((current) => [payload, ...current]);
      setRequestReason("");
      setMessage(`Source request created (${requestType}).`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setIsRequesting(false);
    }
  }

  async function fulfillRequest(sourceRequestId: string) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/forecast/source-requests/${sourceRequestId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfilled_by: "local_operator",
          fulfillment_notes: "Marked fulfilled via Forecast Lab UI.",
          suggested_local_path: `data/processed/countries/${session.target.target_id}/metrics.v1.json`,
        }),
      });
      const payload = (await response.json()) as ForecastSourceRequest & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Fulfillment failed");
      }
      setSourceRequests((current) =>
        current.map((item) =>
          item.source_request_id === sourceRequestId ? payload : item,
        ),
      );
      setMessage("Source request marked fulfilled.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fulfillment failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Agent / player</h2>
        {session.agent_id ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Agent</dt>
              <dd>
                {session.agent_name} ({session.agent_type}) · <code>{session.agent_id}</code>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No agent assigned to this session.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Decision summary (user-visible)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Store rationale and signals only — not hidden chain-of-thought. Editable before lock only.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm text-slate-300">
            Forecast rationale
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:opacity-60"
              disabled={!isEditable}
              onChange={(event) => setForecastRationale(event.target.value)}
              rows={3}
              value={forecastRationale}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Key signals (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:opacity-60"
              disabled={!isEditable}
              onChange={(event) => setKeySignals(event.target.value)}
              rows={3}
              value={keySignals}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Assumptions (one per line)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:opacity-60"
              disabled={!isEditable}
              onChange={(event) => setAssumptions(event.target.value)}
              rows={2}
              value={assumptions}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Uncertainty notes
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:opacity-60"
              disabled={!isEditable}
              onChange={(event) => setUncertaintyNotes(event.target.value)}
              rows={2}
              value={uncertaintyNotes}
            />
          </label>
        </div>
        {isEditable ? (
          <button
            type="button"
            className="mt-4 rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60"
            disabled={isSaving}
            onClick={saveAgentFields}
          >
            {isSaving ? "Saving…" : "Save Agent Fields"}
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
        <h2 className="text-lg font-semibold text-white">Source requests</h2>
        <p className="mt-1 text-sm text-slate-400">
          Request missing local data before lock. After lock, requests are marked too late for the
          original forecast.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Requested source
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
              onChange={(event) => setRequestSourceId(event.target.value)}
              value={requestSourceId}
            >
              {session.allowed_source_ids.map((sourceId) => (
                <option key={sourceId} value={sourceId}>
                  {sourceId}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Reason
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
              onChange={(event) => setRequestReason(event.target.value)}
              rows={2}
              value={requestReason}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-cyan-700 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-950/50 disabled:opacity-50"
            disabled={isRequesting}
            onClick={() => createSourceRequest("human_upload")}
          >
            Request Human Source
          </button>
          <button
            type="button"
            className="rounded-lg border border-violet-700 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-950/50 disabled:opacity-50"
            disabled={isRequesting}
            onClick={() => createSourceRequest("api_fetch")}
          >
            Request API/Data Fetch
          </button>
          <button
            type="button"
            className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
            disabled={isRequesting}
            onClick={() => createSourceRequest("dataset_refresh")}
          >
            Request Dataset Refresh
          </button>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {sourceRequests.length === 0 ? (
            <li className="text-slate-500">No source requests yet.</li>
          ) : (
            sourceRequests.map((request) => (
              <li
                key={request.source_request_id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {request.requested_source_id} · {request.request_type} ·{" "}
                    <span className="text-slate-400">{request.status}</span>
                    {request.too_late_for_forecast ? (
                      <span className="ml-2 text-amber-300">too late for forecast</span>
                    ) : null}
                  </span>
                  {request.status === "open" ? (
                    <button
                      type="button"
                      className="rounded border border-emerald-700 px-2 py-0.5 text-xs text-emerald-200"
                      onClick={() => fulfillRequest(request.source_request_id)}
                    >
                      Mark fulfilled
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-slate-400">{request.reason}</p>
                {request.fulfillment_notes ? (
                  <p className="mt-1 text-xs text-slate-500">{request.fulfillment_notes}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
    </div>
  );
}
