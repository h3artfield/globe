"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DashboardSessionBucket,
  DashboardSessionRow,
  ForecastDashboardResponse,
  ForecastSourceRequest,
  DashboardWorkflowStepId,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";
import {
  EmptyStatePanel,
  FetchModeBanner,
  ForecastDashboardQuestionWorkflow,
} from "@/components/ForecastDashboardQuestionWorkflow";

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

const STEP_SUCCESS_LABELS: Record<DashboardWorkflowStepId, string> = {
  create_session: "Session created.",
  find_news_evidence: "News evidence attached.",
  assess_evidence: "Evidence assessed.",
  plan_source_requests: "Source requests planned.",
  run_cautious_agent: "Cautious agent run complete.",
  run_aggressive_agent: "Aggressive agent run complete.",
  apply_draft: "Draft applied to session.",
  lock_forecast: "Forecast locked.",
  refresh_market: "Market refreshed.",
  resolve_from_market: "Session resolved from market.",
  score_session: "Session scored.",
  judge_session: "Judge audit complete.",
  postmortem_session: "Postmortem generated.",
};

function formatProb(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return value <= 1 ? `${Math.round(value * 100)}%` : `${Math.round(value)}%`;
}

export function ForecastDashboardPageClient() {
  const [dashboard, setDashboard] = useState<ForecastDashboardResponse | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    void loadDashboard()
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Failed to load dashboard");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadDashboard]);

  const activeSessions = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    return BUCKET_ORDER.flatMap((bucket) => dashboard.sessions_by_bucket[bucket] ?? []);
  }, [dashboard]);

  const selectedWorkflow =
    dashboard?.question_workflows.find((item) => item.source_market_id === selectedQuestionId) ?? null;

  const selectedSession =
    activeSessions.find((session) => session.session_id === selectedSessionId) ??
    (selectedWorkflow?.session_id
      ? activeSessions.find((session) => session.session_id === selectedWorkflow.session_id)
      : undefined);

  useEffect(() => {
    if (!selectedQuestionId && (dashboard?.questions.length ?? 0) > 0) {
      setSelectedQuestionId(dashboard!.questions[0]!.source_market_id);
    }
  }, [dashboard, selectedQuestionId]);

  useEffect(() => {
    if (selectedWorkflow?.session_id) {
      setSelectedSessionId(selectedWorkflow.session_id);
    }
  }, [selectedWorkflow?.session_id]);

  const liveFetchDisabled = dashboard?.fetch_modes.some((mode) => !mode.live_fetch_allowed) ?? true;

  async function runAction(label: string, action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(label);
      setLoading(true);
      await loadDashboard();
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Action failed";
      setError(reason);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  async function ensureAgent() {
    if ((dashboard?.agents.length ?? 0) > 0) {
      return dashboard!.agents[0]!.agent_id;
    }
    const response = await fetch("/api/forecast/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dashboard Operator Agent",
        type: "ai",
        description: "Created from Forecast Lab operator dashboard.",
      }),
    });
    const payload = (await response.json()) as { agent_id?: string; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to create agent");
    }
    return payload.agent_id ?? null;
  }

  async function createSession(sourceMarketId: string, agentId?: string | null) {
    const existingWorkflow = dashboard?.question_workflows.find(
      (workflow) => workflow.source_market_id === sourceMarketId && workflow.session_id,
    );
    if (existingWorkflow?.session_id) {
      setSelectedSessionId(existingWorkflow.session_id);
      throw new Error(
        `Session already exists for this question (${existingWorkflow.session_id}). Select it in Active Sessions or open session detail.`,
      );
    }

    const resolvedAgentId = agentId ?? (await ensureAgent());
    if (!resolvedAgentId) {
      throw new Error("No agent available. Create an agent first.");
    }

    const response = await fetch("/api/forecast/question-sources/polymarket/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_market_id: sourceMarketId,
        agent_id: resolvedAgentId,
      }),
    });
    const payload = (await response.json()) as { session_id?: string; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Create session failed");
    }
    if (payload.session_id) {
      setSelectedSessionId(payload.session_id);
    }
  }

  async function runAgentStrategy(sessionId: string, strategyId: string, agentId: string) {
    const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy_id: strategyId, agent_id: agentId }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Agent run failed");
    }
  }

  async function runWorkflowStep(stepId: DashboardWorkflowStepId) {
    const questionId = selectedQuestionId;
    const sessionId = selectedSession?.session_id ?? selectedSessionId;
    switch (stepId) {
      case "create_session":
        await createSession(questionId, dashboard?.agents[0]?.agent_id);
        break;
      case "find_news_evidence":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/news-evidence`,
            { method: "POST" },
          );
          const payload = (await response.json()) as { error?: string; attached_count?: number };
          if (!response.ok) {
            throw new Error(payload.error ?? "Find news evidence failed");
          }
        }
        break;
      case "assess_evidence":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/evidence-assessment`,
            { method: "POST" },
          );
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Assess evidence failed");
          }
        }
        break;
      case "plan_source_requests":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/plan-source-requests`,
            { method: "POST" },
          );
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Plan source requests failed");
          }
        }
        break;
      case "run_cautious_agent":
      case "run_aggressive_agent":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const agentId = selectedSession?.agent_id ?? dashboard?.agents[0]?.agent_id;
          if (!agentId) {
            throw new Error("Assign an agent before running strategies.");
          }
          await runAgentStrategy(
            sessionId,
            stepId === "run_cautious_agent" ? "cautious_source_hound" : "aggressive_pattern_matcher",
            agentId,
          );
        }
        break;
      case "apply_draft":
        if (!sessionId || !selectedSession?.latest_agent_run_id || !selectedSession.agent_id) {
          throw new Error("Need a completed agent run before applying a draft.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/agent-runs/${selectedSession.latest_agent_run_id}/apply`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agent_id: selectedSession.agent_id }),
            },
          );
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Apply draft failed");
          }
        }
        break;
      case "lock_forecast":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/lock`, {
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Lock forecast failed");
          }
        }
        break;
      case "refresh_market":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/refresh-market`,
            { method: "POST" },
          );
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Refresh market failed");
          }
        }
        break;
      case "resolve_from_market":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(
            `/api/forecast/replay/sessions/${sessionId}/resolve-from-market`,
            { method: "POST" },
          );
          const payload = (await response.json()) as {
            error?: string;
            resolved?: boolean;
            message?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error ?? "Resolve from market failed");
          }
          if (!payload.resolved) {
            throw new Error(payload.message ?? "Market not resolved yet");
          }
        }
        break;
      case "score_session":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/score`, {
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Score session failed");
          }
        }
        break;
      case "judge_session":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/judge`, {
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Judge session failed");
          }
        }
        break;
      case "postmortem_session":
        if (!sessionId) {
          throw new Error("Create a session first.");
        }
        {
          const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/postmortem`, {
            method: "POST",
          });
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Postmortem failed");
          }
        }
        break;
      default:
        break;
    }
  }

  async function refreshQuestionMarket(sourceMarketId: string) {
    const linkedSession =
      activeSessions.find((row) => row.source_market_id === sourceMarketId) ??
      (selectedWorkflow?.source_market_id === sourceMarketId ? selectedSession : undefined);
    const sessionId = linkedSession?.session_id ?? selectedSessionId;
    if (!sessionId) {
      await createSession(sourceMarketId, dashboard?.agents[0]?.agent_id);
      throw new Error("Session created. Run Refresh Market again.");
    }
    const response = await fetch(`/api/forecast/replay/sessions/${sessionId}/refresh-market`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Refresh market failed");
    }
  }

  const totalSessions = BUCKET_ORDER.reduce(
    (sum, bucket) => sum + (dashboard?.session_counts[bucket] ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold">Operator Dashboard</h1>
              <p className="mt-2 text-sm text-slate-400">
                Single control room for mock-first Polymarket testing. No auto-lock; lock only when you click it.
              </p>
              {dashboard ? (
                <div className="mt-3">
                  <FetchModeBanner fetchModes={dashboard.fetch_modes} />
                </div>
              ) : null}
            </div>
            <ForecastNav />
          </div>
        </header>

        {dashboard?.operator_warnings.length ? (
          <section className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-100">
            <h2 className="font-semibold">Operator Warnings</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {dashboard.operator_warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-800/60 bg-rose-950/20 p-4 text-sm text-rose-100">
            <h2 className="font-semibold">Action Blocked / Failed</h2>
            <p className="mt-2">{error}</p>
          </section>
        ) : null}

        {message ? (
          <section className="rounded-2xl border border-cyan-800/60 bg-cyan-950/20 p-4 text-sm text-cyan-100">
            {message}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
            Refreshing dashboard…
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

        <EmptyStatePanel emptyStates={dashboard?.empty_states ?? []} />

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold">Guided Question Workflow</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-violet-700 bg-violet-950/50 px-3 py-2 text-sm disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  runAction("Mock Polymarket questions imported.", async () => {
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
                {liveFetchDisabled ? "Refresh Markets (Mock)" : "Refresh Markets"}
              </button>
              {(dashboard?.agents.length ?? 0) === 0 ? (
                <button
                  type="button"
                  className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-sm disabled:opacity-50"
                  disabled={busy}
                  onClick={() => runAction("Test agent created.", () => ensureAgent().then(() => undefined))}
                >
                  Create Test Agent
                </button>
              ) : null}
            </div>
          </div>

          <label className="mt-4 block text-sm text-slate-300">
            Selected question
            <select
              className="ml-2 rounded border border-slate-700 bg-slate-900 px-2 py-1"
              disabled={busy}
              onChange={(event) => setSelectedQuestionId(event.target.value)}
              value={selectedQuestionId}
            >
              <option value="">—</option>
              {(dashboard?.questions ?? []).map((question) => (
                <option key={question.source_market_id} value={question.source_market_id}>
                  {question.title.slice(0, 72)}
                </option>
              ))}
            </select>
          </label>

          <ForecastDashboardQuestionWorkflow
            busy={busy}
            fetchModes={dashboard?.fetch_modes ?? []}
            workflow={selectedWorkflow}
            onRunStep={(stepId) =>
              runAction(STEP_SUCCESS_LABELS[stepId], () => runWorkflowStep(stepId))
            }
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Live Question Queue</h2>
            {(dashboard?.questions.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No imported questions. Use Ingest Mock Polymarket Questions to load fixtures.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {(dashboard?.questions ?? []).map((question) => (
                  <li
                    key={question.source_market_id}
                    className={`rounded-lg border p-3 ${
                      question.source_market_id === selectedQuestionId
                        ? "border-cyan-700 bg-cyan-950/20"
                        : "border-slate-800 bg-slate-900/50"
                    }`}
                  >
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedQuestionId(question.source_market_id)}
                    >
                      <p className="font-medium text-cyan-200">{question.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {question.category} · {question.resolution_status} · implied{" "}
                        {formatProb(question.implied_probability)}
                      </p>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-violet-700 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          runAction("Session created.", () =>
                            createSession(question.source_market_id, dashboard?.agents[0]?.agent_id),
                          )
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
                        {liveFetchDisabled ? "Refresh Market (Mock)" : "Refresh Market"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Agent Performance Summary</h2>
            {(dashboard?.agents.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No agents yet. Click Create Test Agent above, or create one from the Agents page.
              </p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {dashboard!.agents.map((agent) => (
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
                      {agent.average_brier_score?.toFixed(4) ?? "n/a"} · needs_sources{" "}
                      {agent.needs_sources_count}
                    </p>
                    {agent.recent_runs.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">No agent runs yet for this agent.</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">
                        Recent: {agent.recent_runs.map((run) => `${run.strategy_id}:${run.status}`).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Active Forecast Sessions</h2>
          {totalSessions === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No sessions yet. Select a question and run Create Session in the guided workflow.
            </p>
          ) : (
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
                          onSelect={() => {
                            setSelectedSessionId(session.session_id);
                            if (session.source_market_id) {
                              setSelectedQuestionId(session.source_market_id);
                            }
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Evidence / Source Request Inbox</h2>
          {(dashboard?.open_source_requests.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Inbox clear. Run Plan Source Requests when evidence assessment recommends more sources.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {dashboard!.open_source_requests.map((request) => (
                <SourceRequestRow
                  key={request.source_request_id}
                  busy={busy}
                  request={request}
                  onAction={(label, fn) => runAction(label, fn)}
                />
              ))}
            </ul>
          )}
        </section>

        {(dashboard?.recent_market_refreshes.length ?? 0) === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Recent Market Refreshes</h2>
            <p className="mt-3 text-sm text-slate-500">
              No refreshes logged yet. Create a live Polymarket session and use Refresh Market.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-semibold">Recent Market Refreshes</h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              {dashboard!.recent_market_refreshes.slice(0, 8).map((refresh) => (
                <li key={refresh.refresh_id}>
                  {refresh.source_market_id} · {refresh.market_status} · implied{" "}
                  {formatProb(refresh.implied_probability)} ·{" "}
                  {new Date(refresh.fetched_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        )}
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
            {session.session_id} · evidence{" "}
            {session.evidence_score != null ? `${Math.round(session.evidence_score * 100)}%` : "—"} ·{" "}
            {session.recommendation ?? "—"}
          </p>
        </button>
        <Link className="text-xs text-cyan-300" href={`/forecast/replay/${session.session_id}`}>
          Open
        </Link>
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
      <p className="mt-1 text-xs text-slate-500">session {request.session_id}</p>
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
