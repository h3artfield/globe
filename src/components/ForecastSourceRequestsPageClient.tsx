"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ForecastSourceRequest,
  ReplayEvidenceSnapshot,
  SourceFulfillmentArtifact,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

type FulfillmentDraft = {
  localPath: string;
  noteText: string;
  safeForSnapshot: boolean;
  adapterId: string;
};

const ADAPTER_OPTIONS = [
  { id: "", label: "Auto / manual file" },
  { id: "manual_file", label: "manual_file" },
  { id: "unodc", label: "unodc" },
  { id: "vdem", label: "vdem" },
  { id: "ucdp", label: "ucdp" },
  { id: "un_comtrade_bilateral", label: "un_comtrade_bilateral" },
  { id: "wvs", label: "wvs" },
  { id: "gdelt_news_events", label: "gdelt_news_events (scaffold)" },
];

export function ForecastSourceRequestsPageClient() {
  const [requests, setRequests] = useState<ForecastSourceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FulfillmentDraft>>({});
  const [artifacts, setArtifacts] = useState<Record<string, SourceFulfillmentArtifact>>({});
  const [snapshotCounts, setSnapshotCounts] = useState<Record<string, number>>({});

  const loadRequests = useCallback(async () => {
    const query = statusFilter ? `?status=${statusFilter}` : "";
    const response = await fetch(`/api/forecast/source-requests${query}`);
    const payload = (await response.json()) as { requests: ForecastSourceRequest[] };
    setRequests(payload.requests ?? []);
  }, [statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function draftFor(request: ForecastSourceRequest): FulfillmentDraft {
    const existing = drafts[request.source_request_id];
    if (existing) {
      return existing;
    }
    return {
      localPath: request.suggested_local_path ?? "",
      noteText: "",
      safeForSnapshot: true,
      adapterId: request.suggested_api_adapter ?? "",
    };
  }

  function updateDraft(sourceRequestId: string, request: ForecastSourceRequest, patch: Partial<FulfillmentDraft>) {
    setDrafts((current) => ({
      ...current,
      [sourceRequestId]: { ...draftFor(request), ...patch },
    }));
  }

  async function regenerateSnapshot(sessionId: string, sourceRequestId: string) {
    const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`, {
      method: "POST",
    });
    const payload = (await response.json()) as ReplayEvidenceSnapshot & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Evidence snapshot regeneration failed");
    }
    setSnapshotCounts((current) => ({
      ...current,
      [sourceRequestId]: payload.included_records.length,
    }));
    return payload;
  }

  async function fulfillRequest(request: ForecastSourceRequest, mode: "path" | "note" | "adapter") {
    const draft = draftFor(request);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        fulfilled_by: "local_operator",
        safe_for_evidence_snapshot: draft.safeForSnapshot,
        cutoff_year: request.cutoff_year,
        source_id: request.requested_source_id,
      };

      if (mode === "path") {
        if (!draft.localPath.trim()) {
          throw new Error("Provide a local file path.");
        }
        body.local_path = draft.localPath.trim();
        body.fulfillment_type = "human_file";
        body.fulfillment_notes = `Fulfilled with local path: ${draft.localPath.trim()}`;
      } else if (mode === "note") {
        if (!draft.noteText.trim()) {
          throw new Error("Provide fulfillment notes.");
        }
        body.note_text = draft.noteText.trim();
        body.fulfillment_type = "note_only";
        body.fulfillment_notes = draft.noteText.trim();
      } else {
        const adapterId = draft.adapterId || request.suggested_api_adapter;
        if (!adapterId) {
          throw new Error("Select an adapter to run.");
        }
        const response = await fetch(
          `/api/forecast/source-requests/${request.source_request_id}/run-adapter`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adapter_id: adapterId,
              safe_for_evidence_snapshot: draft.safeForSnapshot,
              fulfilled_by: "local_operator",
            }),
          },
        );
        const payload = (await response.json()) as {
          artifact: SourceFulfillmentArtifact;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Adapter fulfillment failed");
        }
        setArtifacts((current) => ({
          ...current,
          [request.source_request_id]: payload.artifact,
        }));
        if (request.usable_for_original_forecast !== false) {
          await regenerateSnapshot(request.session_id, request.source_request_id);
        }
        setMessage(`Request ${request.source_request_id} fulfilled via ${adapterId}.`);
        await loadRequests();
        return;
      }

      const response = await fetch(
        `/api/forecast/source-requests/${request.source_request_id}/fulfill`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as {
        artifact: SourceFulfillmentArtifact;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Fulfillment failed");
      }
      setArtifacts((current) => ({
        ...current,
        [request.source_request_id]: payload.artifact,
      }));
      if (payload.artifact.usable_for_original_forecast) {
        await regenerateSnapshot(request.session_id, request.source_request_id);
      }
      setMessage(`Request ${request.source_request_id} fulfilled (${mode}).`);
      await loadRequests();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Fulfillment failed");
    }
  }

  async function updateStatus(
    sourceRequestId: string,
    status: "rejected" | "unavailable",
  ) {
    await fetch(`/api/forecast/source-requests/${sourceRequestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMessage(`Request ${sourceRequestId} marked ${status}.`);
    await loadRequests();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold">Source Request Queue</h1>
              <p className="mt-2 text-sm text-slate-400">
                Fulfill with local paths, notes, or local adapters. Safe fulfillments regenerate
                evidence snapshots before lock.
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <label className="text-sm text-slate-300">
            Filter by status
            <select
              className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">All</option>
              <option value="open">open</option>
              <option value="fulfilled">fulfilled</option>
              <option value="rejected">rejected</option>
              <option value="unavailable">unavailable</option>
            </select>
          </label>

          <ul className="mt-4 space-y-3 text-sm">
            {requests.map((request) => {
              const draft = draftFor(request);
              const artifact = artifacts[request.source_request_id];
              return (
                <li
                  key={request.source_request_id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {request.requested_source_id} · {request.request_type} · {request.status}
                        {request.too_late_for_forecast ? (
                          <span className="ml-2 text-amber-300">too late for original forecast</span>
                        ) : request.usable_for_original_forecast ? (
                          <span className="ml-2 text-emerald-300">usable for original forecast</span>
                        ) : null}
                      </p>
                      <p className="text-slate-400">{request.reason}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        template={request.template_id} · cutoff={request.cutoff_year} · agent=
                        {request.agent_id ?? "none"} · adapter={request.suggested_api_adapter ?? "n/a"}
                      </p>
                      {request.fulfillment_notes ? (
                        <p className="text-xs text-emerald-300">{request.fulfillment_notes}</p>
                      ) : null}
                      {artifact ? (
                        <p className="mt-1 text-xs text-cyan-300">
                          artifact: {artifact.records_usable.length} usable /{" "}
                          {artifact.records_found} found · future rejected=
                          {artifact.rejected_future_records_count} · safe=
                          {String(artifact.safe_for_evidence_snapshot)}
                        </p>
                      ) : null}
                      {snapshotCounts[request.source_request_id] !== undefined ? (
                        <p className="text-xs text-cyan-200">
                          evidence snapshot now includes {snapshotCounts[request.source_request_id]}{" "}
                          record(s)
                        </p>
                      ) : null}
                      <Link
                        className="mt-1 inline-block text-cyan-300 hover:text-cyan-100"
                        href={`/forecast/replay/${request.session_id}`}
                      >
                        Open session
                      </Link>
                    </div>
                    {request.status === "open" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-rose-700 px-2 py-1 text-xs"
                          onClick={() => updateStatus(request.source_request_id, "rejected")}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="rounded border border-amber-700 px-2 py-1 text-xs"
                          onClick={() => updateStatus(request.source_request_id, "unavailable")}
                        >
                          Unavailable
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {request.status === "open" &&
                  (request.request_type === "human_upload" ||
                    request.request_type === "dataset_refresh") ? (
                    <div className="mt-3 grid gap-2 rounded border border-slate-800 p-3 text-xs">
                      <label className="block text-slate-300">
                        Local path (CSV / JSON / JSONL / markdown)
                        <input
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                          onChange={(event) =>
                            updateDraft(request.source_request_id, request, {
                              localPath: event.target.value,
                            })
                          }
                          placeholder="data/processed/countries/USA/metrics.v1.json"
                          value={draft.localPath}
                        />
                      </label>
                      <label className="block text-slate-300">
                        Fulfillment note
                        <textarea
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                          onChange={(event) =>
                            updateDraft(request.source_request_id, request, {
                              noteText: event.target.value,
                            })
                          }
                          rows={2}
                          value={draft.noteText}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-slate-300">
                        <input
                          checked={draft.safeForSnapshot}
                          onChange={(event) =>
                            updateDraft(request.source_request_id, request, {
                              safeForSnapshot: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        Safe for evidence snapshot
                      </label>
                      <label className="block text-slate-300">
                        Local adapter
                        <select
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                          onChange={(event) =>
                            updateDraft(request.source_request_id, request, {
                              adapterId: event.target.value,
                            })
                          }
                          value={draft.adapterId}
                        >
                          {ADAPTER_OPTIONS.map((option) => (
                            <option key={option.id || "auto"} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-emerald-700 px-2 py-1"
                          onClick={() => fulfillRequest(request, "path")}
                        >
                          Fulfill with local path
                        </button>
                        <button
                          type="button"
                          className="rounded border border-cyan-700 px-2 py-1"
                          onClick={() => fulfillRequest(request, "note")}
                        >
                          Fulfill with note
                        </button>
                        <button
                          type="button"
                          className="rounded border border-violet-700 px-2 py-1"
                          onClick={() => fulfillRequest(request, "adapter")}
                        >
                          Run local adapter
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
      </div>
    </main>
  );
}
