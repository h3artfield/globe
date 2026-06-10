"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  AgentPerformanceSummary,
  ForecastAgentProfile,
  ForecastAgentRun,
  ForecastAgentStrategy,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

export function ForecastAgentsPageClient() {
  const [agents, setAgents] = useState<ForecastAgentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [performance, setPerformance] = useState<AgentPerformanceSummary | null>(null);
  const [agentRuns, setAgentRuns] = useState<ForecastAgentRun[]>([]);
  const [savedStrategy, setSavedStrategy] = useState<ForecastAgentStrategy | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"human" | "ai" | "hybrid">("human");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAgents() {
    const response = await fetch("/api/forecast/agents");
    const payload = (await response.json()) as { agents: ForecastAgentProfile[] };
    setAgents(payload.agents ?? []);
    if (!selectedId && payload.agents?.[0]) {
      setSelectedId(payload.agents[0].agent_id);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void fetch(`/api/forecast/agents/${selectedId}/performance`)
      .then((response) => response.json())
      .then((payload) => setPerformance(payload as AgentPerformanceSummary))
      .catch(() => setPerformance(null));
    void fetch(`/api/forecast/agents/${selectedId}/runs`)
      .then((response) => response.json())
      .then((payload) => setAgentRuns((payload as { runs: ForecastAgentRun[] }).runs ?? []))
      .catch(() => setAgentRuns([]));
    void fetch(`/api/forecast/agents/${selectedId}/strategy`)
      .then((response) => response.json())
      .then((payload) =>
        setSavedStrategy((payload as { saved_strategy: ForecastAgentStrategy | null }).saved_strategy),
      )
      .catch(() => setSavedStrategy(null));
  }, [selectedId]);

  async function createAgent() {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/forecast/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, description: "Forecast Lab agent" }),
    });
    const payload = (await response.json()) as ForecastAgentProfile & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Create failed");
      return;
    }
    setMessage(`Agent created: ${payload.name}`);
    setName("");
    await loadAgents();
    setSelectedId(payload.agent_id);
  }

  async function recomputePerformance() {
    if (!selectedId) {
      return;
    }
    const response = await fetch(`/api/forecast/agents/${selectedId}/recompute-performance`, {
      method: "POST",
    });
    const payload = (await response.json()) as AgentPerformanceSummary & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Recompute failed");
      return;
    }
    setPerformance(payload);
    setMessage("Performance recomputed.");
    await loadAgents();
  }

  const selectedAgent = agents.find((agent) => agent.agent_id === selectedId) ?? null;
  const needsSourcesCount = agentRuns.filter((run) => run.status === "needs_sources").length;
  const completedRuns = agentRuns.filter((run) => run.status === "completed");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Agents</h1>
              <p className="mt-2 text-sm text-slate-400">
                Closed-loop improvement: calibration, rules, and open source requests.
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <h2 className="text-lg font-semibold">Create agent</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
              onChange={(event) => setName(event.target.value)}
              placeholder="Agent name"
              value={name}
            />
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
              onChange={(event) => setType(event.target.value as "human" | "ai" | "hybrid")}
              value={type}
            >
              <option value="human">human</option>
              <option value="ai">ai</option>
              <option value="hybrid">hybrid</option>
            </select>
            <button
              type="button"
              className="rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-100"
              onClick={createAgent}
            >
              Create Agent
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agent list ({agents.length})</h2>
            <select
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
              onChange={(event) => setSelectedId(event.target.value)}
              value={selectedId}
            >
              {agents.map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.name} ({agent.type})
                </option>
              ))}
            </select>
          </div>

          {selectedAgent ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                {selectedAgent.name} · {selectedAgent.type} ·{" "}
                <code>{selectedAgent.agent_id}</code>
              </p>
              <p className="text-slate-400">{selectedAgent.calibration_summary || "No calibration summary yet."}</p>
              {selectedAgent.next_time_rules.length > 0 ? (
                <div>
                  <p className="font-medium text-amber-200">Next-time rules</p>
                  <ul className="mt-1 list-disc pl-5">
                    {selectedAgent.next_time_rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-violet-700 px-3 py-1.5 text-xs text-violet-100"
                onClick={recomputePerformance}
              >
                Recompute performance
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No agents yet.</p>
          )}
        </section>

        {performance ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">Performance summary</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Forecasts</dt>
                <dd>
                  {performance.resolved_forecasts} resolved / {performance.total_forecasts} total
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Average Brier</dt>
                <dd>{performance.average_brier_score?.toFixed(4) ?? "n/a"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Direction accuracy</dt>
                <dd>
                  {performance.direction_accuracy != null
                    ? `${(performance.direction_accuracy * 100).toFixed(1)}%`
                    : "n/a"}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-300">Calibration buckets</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {performance.calibration_buckets.map((bucket) => (
                  <li key={bucket.bucket}>
                    {bucket.bucket}%: {bucket.count} forecasts · avg Brier{" "}
                    {bucket.average_brier?.toFixed(4) ?? "n/a"}
                  </li>
                ))}
              </ul>
            </div>
            {Object.keys(performance.performance_by_template_id).length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-300">By template</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {Object.entries(performance.performance_by_template_id).map(([templateId, stats]) => (
                    <li key={templateId}>
                      {templateId}: n={stats.count} · Brier{" "}
                      {stats.average_brier?.toFixed(4) ?? "n/a"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {selectedAgent ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
            <h2 className="text-lg font-semibold">Agent strategy & runs</h2>
            <p className="mt-2 text-sm text-slate-400">
              Saved strategy: {savedStrategy?.name ?? "none (using built-in strategies on session page)"}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Recent runs</dt>
                <dd>{agentRuns.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">needs_sources runs</dt>
                <dd>{needsSourcesCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Completed runs</dt>
                <dd>{completedRuns.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Avg score (resolved sessions)</dt>
                <dd>{performance?.average_brier_score?.toFixed(4) ?? "n/a"}</dd>
              </div>
            </dl>
            {agentRuns.length > 0 ? (
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {agentRuns.slice(0, 5).map((run) => (
                  <li key={run.agent_run_id} className="rounded border border-slate-800 px-2 py-1">
                    {run.created_at} · {run.status} · {run.strategy_id} · session {run.session_id}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="text-sm text-cyan-300">{message}</p> : null}

        <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/forecast">
          Back to Forecast Lab
        </Link>
      </div>
    </main>
  );
}
