"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DashboardSessionBucket,
  DashboardSessionRow,
  ForecastDashboardResponse,
  ForecastSourceRequest,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

const BUCKET_LABELS: Record<DashboardSessionBucket, string> = {
  draft: "Draft",
  locked: "Locked",
  resolved: "Resolved",
  needs_sources: "Needs Sources",
  human_review: "Human Review",
};

const BUCKET_ORDER: DashboardSessionBucket[] = [
  "needs_sources",
  "human_review",
  "draft",
  "locked",
  "resolved",
];

function formatProb(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return value <= 1 ? `${Math.round(value * 100)}%` : `${Math.round(value)}%`;
}

export function ForecastDashboardPageClient() {
  const [dashboard, setDashboard] = useState<ForecastDashboardResponse | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/forecast/dashboard");
    const payload = (await response.json()) as ForecastDashboardResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load dashboard");
    }
    setDashboard(payload);
    return payload;
  }, []);

  useEffect(() => {
    void loadDashboard().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Failed to load dashboard");
    });
  }, [loadDashboard]);

  const activeSessions = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    return BUCKET_ORDER.flatMap((bucket) => dashboard.sessions_by_bucket[bucket] ?? []);
  }, [dashboard]);

  const selectedSession = activeSessions.find((session) => session.session_id === selectedSessionId);

  useEffect(() => {
    if (!selectedSessionId && activeSessions.length > 0) {
      setSelectedSessionId(activeSessions[0]!.session_id);
    }
  }, [activeSessions, selectedSessionId]);

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(label);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function createSession(sourceMarketId: string) {
    const response = await fetch("/api/forecast/question-sources/polymarket/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_market_id: sourceMarketId }),
    });
    const payload = (await response.json()) as { session_id?: string; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Create session failed");
    }
    if (payload.session_id) {
      setSelectedSessionId(payload.session_id);
    }
  }

  async function refreshQuestionMarket(sourceMarketId: string) {
    await createSession(sourceMarketId).catch(() => undefined);
    const session = activeSessions.find((row) => row.source_market_id === sourceMarketId);
    const sessionId = session?.session_id ?? selectedSessionId;
    if (!sessionId) {
      throw new Error("Create a session for this question before refreshing market metadata.");
    }
    const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/refresh-market`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Refresh market failed");
    }
  }

  async function updateSourceRequestStatus(
    sourceRequestId: string,
    status: "rejected" | "unavailable" | "fulfilled",
  ) {
    const response = await fetch(`/api/forecast/source-requests/${sourceRequestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        fulfillment_notes:
          status === "fulfilled" ? "Marked fulfilled from dashboard operator action." : undefined,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? `Failed to mark ${status}`);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold">Operator Dashboard</h1>
              <p className="mt-2 text-sm text-slate-400">
                Control room for questions, sessions, evidence, source requests, and agents.
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Operator Actions</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-300">
              Selected session
              <select
                className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                disabled={busy}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                value={selectedSessionId}
              >
                <option value="">—</option>
                {activeSessions.map((session) => (
                  <option key={session.session_id} value={session.session_id}>
                    {session.session_id.slice(-12)} · {session.question_text.slice(0, 48)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-violet-700 bg-violet-950/50 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                runAction("Mock Polymarket ingest complete.", async () => {
                  const response = await fetch("/api/forecast/question-sources/polymarket/ingest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ use_mock: true }),
                  });
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Ingest failed");
                  }
                })
              }
            >
              Ingest Mock Polymarket Questions
            </button>
            <button
              type="button"
              className="rounded-lg border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                runAction("Markets refreshed.", async () => {
                  const response = await fetch("/api/forecast/question-sources/polymarket/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ use_mock: true }),
                  });
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Refresh failed");
                  }
                })
              }
            >
              Refresh Markets
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSessionId}
              onClick={() =>
                runAction("News evidence attached.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/news-evidence`,
                    { method: "POST" },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "News evidence failed");
                  }
                })
              }
            >
              Find News Evidence
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSessionId}
              onClick={() =>
                runAction("Evidence assessed.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/evidence-assessment`,
                    { method: "POST" },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Assess evidence failed");
                  }
                })
              }
            >
              Assess Evidence
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSessionId}
              onClick={() =>
                runAction("Source requests planned.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/plan-source-requests`,
                    { method: "POST" },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Plan source requests failed");
                  }
                })
              }
            >
              Plan Source Requests
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSessionId}
              onClick={() =>
                runAction("Agent run completed.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/agent-runs`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        strategy_id: "balanced_baseline",
                        agent_id: selectedSession?.agent_id ?? undefined,
                      }),
                    },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Agent run failed");
                  }
                })
              }
            >
              Run Agent
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSession?.latest_agent_run_id || !selectedSession?.agent_id}
              onClick={() =>
                runAction("Draft applied to session.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/agent-runs/${selectedSession!.latest_agent_run_id}/apply`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ agent_id: selectedSession!.agent_id }),
                    },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Apply draft failed");
                  }
                })
              }
            >
              Apply Draft
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSessionId || selectedSession?.status !== "draft"}
              onClick={() =>
                runAction("Forecast locked.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/lock`,
                    { method: "POST" },
                  );
                  const payload = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Lock failed");
                  }
                })
              }
            >
              Lock Forecast
            </button>
            <button
              type="button"
              className="rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm disabled:opacity-50"
              disabled={busy || !selectedSession?.resolvable_from_market}
              onClick={() =>
                runAction("Resolved from market.", async () => {
                  const response = await fetch(
                    `/api/forecast/replay/sessions/${selectedSessionId}/resolve-from-market`,
                    { method: "POST" },
                  );
                  const payload = (await response.json()) as { error?: string; resolved?: boolean; message?: string };
                  if (!response.ok) {
                    throw new Error(payload.error ?? "Resolve from market failed");
                  }
                  if (!payload.resolved) {
                    throw new Error(payload.message ?? "Market not resolved yet");
                  }
                })
              }
            >
              Resolve From Market
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-cyan-300">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </section>

        {dashboard?.warnings.length ? (
          <section className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-100">
            <h2 className="font-semibold">Warnings</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dashboard.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {dashboard?.errors.length ? (
          <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 p-4 text-sm text-rose-100">
            <h2 className="font-semibold">Errors</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dashboard.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Live Question Queue</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {(dashboard?.questions ?? []).map((question) => (
                <li
                  key={question.source_market_id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                >
                  <p className="font-medium text-cyan-200">{question.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {question.category} · {question.resolution_status} · implied{" "}
                    {formatProb(question.implied_probability)} · vol {question.volume ?? "—"} · liq{" "}
                    {question.liquidity ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">End {question.end_date ?? "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-violet-700 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={busy}
                      onClick={() =>
                        runAction("Session created.", () => createSession(question.source_market_id))
                      }
                    >
                      Create Session
                    </button>
                    <button
                      type="button"
                      className="rounded border border-cyan-700 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={busy}
                      onClick={() =>
                        runAction("Question market refreshed.", () =>
                          refreshQuestionMarket(question.source_market_id),
                        )
                      }
                    >
                      Refresh Market
                    </button>
                    <a
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                      href={question.source_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Source
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Agent Performance Summary</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {(dashboard?.agents ?? []).map((agent) => (
                <li
                  key={agent.agent_id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {agent.agent_name}{" "}
                      <span className="text-slate-500">({agent.agent_type})</span>
                    </p>
                    <Link className="text-xs text-cyan-300" href="/forecast/agents">
                      Details
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Resolved {agent.resolved_forecasts}/{agent.total_forecasts} · Brier{" "}
                    {agent.average_brier_score?.toFixed(4) ?? "n/a"} · Direction{" "}
                    {agent.direction_accuracy != null
                      ? `${(agent.direction_accuracy * 100).toFixed(1)}%`
                      : "n/a"}{" "}
                    · needs_sources {agent.needs_sources_count}
                  </p>
                  {agent.recent_runs.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Recent:{" "}
                      {agent.recent_runs
                        .map((run) => `${run.strategy_id}:${run.status}`)
                        .join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Active Forecast Sessions</h2>
          <div className="mt-4 space-y-4">
            {BUCKET_ORDER.map((bucket) => {
              const rows = dashboard?.sessions_by_bucket[bucket] ?? [];
              if (rows.length === 0) {
                return null;
              }
              return (
                <div key={bucket}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {BUCKET_LABELS[bucket]} ({rows.length})
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {rows.map((session) => (
                      <SessionRow
                        key={session.session_id}
                        selected={session.session_id === selectedSessionId}
                        session={session}
                        onSelect={() => setSelectedSessionId(session.session_id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Evidence / Source Request Inbox</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {(dashboard?.open_source_requests ?? []).map((request) => (
              <SourceRequestRow
                key={request.source_request_id}
                busy={busy}
                request={request}
                onAction={(label, fn) => runAction(label, fn)}
              />
            ))}
            {(dashboard?.open_source_requests.length ?? 0) === 0 ? (
              <li className="text-slate-500">No open source requests.</li>
            ) : null}
          </ul>
        </section>

        {(dashboard?.recent_market_refreshes.length ?? 0) > 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Recent Market Refreshes</h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              {dashboard!.recent_market_refreshes.slice(0, 8).map((refresh) => (
                <li key={refresh.refresh_id}>
                  {refresh.source_market_id} · {refresh.market_status} · implied{" "}
                  {formatProb(refresh.implied_probability)} · {new Date(refresh.fetched_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SessionRow({
  session,
  selected,
  onSelect,
}: {
  session: DashboardSessionRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={`rounded-lg border p-3 text-sm ${selected ? "border-cyan-700 bg-cyan-950/20" : "border-slate-800 bg-slate-900/50"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="text-left" onClick={onSelect}>
          <p className="font-medium text-slate-100">{session.question_text.slice(0, 120)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {session.session_id} · {session.agent_name ?? "no agent"} · prob{" "}
            {session.probability ?? "—"} · evidence{" "}
            {session.evidence_score != null ? `${Math.round(session.evidence_score * 100)}%` : "—"} ·{" "}
            {session.recommendation ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            gaps {session.source_gap_count} · open requests {session.open_source_request_count} · market{" "}
            {session.market_status ?? "—"} · updated {new Date(session.last_updated).toLocaleString()}
          </p>
        </button>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link className="text-cyan-300" href={`/forecast/replay/${session.session_id}`}>
            Open
          </Link>
          <Link className="text-violet-300" href="/forecast/source-requests">
            Requests
          </Link>
        </div>
      </div>
    </li>
  );
}

function SourceRequestRow({
  request,
  busy,
  onAction,
}: {
  request: ForecastSourceRequest;
  busy: boolean;
  onAction: (label: string, fn: () => Promise<void>) => void;
}) {
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <p className="font-medium text-amber-200">
        {request.request_type} · {request.requested_source_id} · {request.priority}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {request.source_request_id} · session {request.session_id} · {request.status}
      </p>
      <p className="mt-1 text-sm text-slate-400">{request.reason}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="text-xs text-cyan-300" href={`/forecast/replay/${request.session_id}`}>
          Session
        </Link>
        <button
          type="button"
          className="rounded border border-emerald-700 px-2 py-1 text-xs disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            onAction("Request marked fulfilled.", () =>
              updateRequestStatus(request.source_request_id, "fulfilled"),
            )
          }
        >
          Fulfill
        </button>
        <button
          type="button"
          className="rounded border border-rose-700 px-2 py-1 text-xs disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            onAction("Request rejected.", () =>
              updateRequestStatus(request.source_request_id, "rejected"),
            )
          }
        >
          Reject
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            onAction("Request marked unavailable.", () =>
              updateRequestStatus(request.source_request_id, "unavailable"),
            )
          }
        >
          Unavailable
        </button>
      </div>
    </li>
  );
}

async function updateRequestStatus(
  sourceRequestId: string,
  status: "rejected" | "unavailable" | "fulfilled",
) {
  const response = await fetch(`/api/forecast/source-requests/${sourceRequestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      fulfillment_notes:
        status === "fulfilled" ? "Marked fulfilled from dashboard operator action." : undefined,
    }),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Failed to mark ${status}`);
  }
}
