"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ForecastSourceRequest } from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

export function ForecastSourceRequestsPageClient() {
  const [requests, setRequests] = useState<ForecastSourceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const query = statusFilter ? `?status=${statusFilter}` : "";
    const response = await fetch(`/api/forecast/source-requests${query}`);
    const payload = (await response.json()) as { requests: ForecastSourceRequest[] };
    setRequests(payload.requests ?? []);
  }, [statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function updateStatus(
    sourceRequestId: string,
    status: "fulfilled" | "rejected" | "unavailable",
    sessionId: string,
  ) {
    if (status === "fulfilled") {
      await fetch(`/api/forecast/source-requests/${sourceRequestId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillment_notes: "Fulfilled from global queue." }),
      });
      await fetch(`/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`, {
        method: "POST",
      });
    } else {
      await fetch(`/api/forecast/source-requests/${sourceRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }
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
                Global queue across all replay sessions. Fulfillment regenerates evidence when local
                data is linked.
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
            {requests.map((request) => (
              <li
                key={request.source_request_id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {request.requested_source_id} · {request.request_type} · {request.status}
                      {request.too_late_for_forecast ? (
                        <span className="ml-2 text-amber-300">too late for original forecast</span>
                      ) : null}
                    </p>
                    <p className="text-slate-400">{request.reason}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      template={request.template_id} · cutoff={request.cutoff_year} · agent=
                      {request.agent_id ?? "none"} · adapter={request.suggested_api_adapter ?? "n/a"}
                    </p>
                    {request.suggested_local_path ? (
                      <p className="text-xs text-slate-500">path: {request.suggested_local_path}</p>
                    ) : null}
                    {request.human_instructions ? (
                      <p className="text-xs text-slate-500">{request.human_instructions}</p>
                    ) : null}
                    {request.fulfillment_notes ? (
                      <p className="text-xs text-emerald-300">{request.fulfillment_notes}</p>
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
                        className="rounded border border-emerald-700 px-2 py-1 text-xs"
                        onClick={() =>
                          updateStatus(request.source_request_id, "fulfilled", request.session_id)
                        }
                      >
                        Fulfill
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-700 px-2 py-1 text-xs"
                        onClick={() =>
                          updateStatus(request.source_request_id, "rejected", request.session_id)
                        }
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="rounded border border-amber-700 px-2 py-1 text-xs"
                        onClick={() =>
                          updateStatus(request.source_request_id, "unavailable", request.session_id)
                        }
                      >
                        Unavailable
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
      </div>
    </main>
  );
}
