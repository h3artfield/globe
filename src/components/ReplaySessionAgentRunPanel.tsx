"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ForecastAgentRun, ForecastAgentStrategy, ReplaySession } from "@/types/forecasting";
import { BUILTIN_AGENT_STRATEGIES } from "@/lib/forecasting/builtInAgentStrategies";

type ReplaySessionAgentRunPanelProps = {
  session: ReplaySession;
};

export function ReplaySessionAgentRunPanel({ session }: ReplaySessionAgentRunPanelProps) {
  const router = useRouter();
  const isDraft = session.status === "draft";
  const [strategyId, setStrategyId] = useState("balanced_baseline");
  const [runs, setRuns] = useState<ForecastAgentRun[]>([]);
  const [latestRun, setLatestRun] = useState<ForecastAgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function loadRuns() {
    const response = await fetch(`/api/forecast/replay/sessions/${session.session_id}/agent-runs`);
    const payload = (await response.json()) as { runs: ForecastAgentRun[] };
    setRuns(payload.runs ?? []);
    setLatestRun(payload.runs?.[0] ?? null);
  }

  useEffect(() => {
    void loadRuns();
  }, [session.session_id]);

  async function runAgent() {
    if (!session.agent_id) {
      setError("Assign an agent to this session before running.");
      return;
    }
    setIsRunning(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/agent-runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy_id: strategyId,
            agent_id: session.agent_id,
          }),
        },
      );
      const payload = (await response.json()) as ForecastAgentRun & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Agent run failed");
      }
      setLatestRun(payload);
      setMessage(`Agent run ${payload.status}.`);
      await loadRuns();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent run failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function applyDraft() {
    if (!latestRun || !session.agent_id) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/agent-runs/${latestRun.agent_run_id}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: session.agent_id }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Apply failed");
      }
      setMessage("Agent draft applied to forecast fields.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Apply failed");
    }
  }

  const strategies: ForecastAgentStrategy[] = BUILTIN_AGENT_STRATEGIES;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <h2 className="text-lg font-semibold text-white">Agent Run</h2>
      <p className="mt-1 text-sm text-slate-400">
        Local deterministic strategy run using evidence snapshot only. Does not auto-lock.
      </p>

      {!session.agent_id ? (
        <p className="mt-3 text-sm text-amber-300">No agent assigned to this session.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Strategy
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white disabled:opacity-60"
              disabled={!isDraft}
              onChange={(event) => setStrategyId(event.target.value)}
              value={strategyId}
            >
              {strategies.map((strategy) => (
                <option key={strategy.strategy_id} value={strategy.strategy_id}>
                  {strategy.name} ({strategy.risk_style})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg border border-violet-700 px-4 py-2 text-sm text-violet-100 hover:bg-violet-950/50 disabled:opacity-50"
            disabled={!isDraft || isRunning}
            onClick={runAgent}
          >
            {isRunning ? "Running…" : "Run Agent"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-950/50 disabled:opacity-50"
            disabled={!isDraft || latestRun?.status !== "completed"}
            onClick={applyDraft}
          >
            Apply Draft to Forecast
          </button>
        </div>
      )}

      {latestRun ? (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm">
          <p className="font-medium">
            Latest run · {latestRun.status} · {latestRun.strategy_id}
          </p>
          <p className="mt-1 text-slate-400">{latestRun.rationale}</p>
          {latestRun.probability !== null ? (
            <p className="mt-1">
              Draft probability: {latestRun.probability}% · confidence: {latestRun.confidence}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            recommended: {latestRun.recommended_action} · created:{" "}
            {latestRun.source_request_ids_created.length} · reused:{" "}
            {(latestRun.source_request_ids_reused ?? []).length}
          </p>
          {latestRun.key_signals.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-400">
              {latestRun.key_signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {runs.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Run history ({runs.length})
          </p>
          <ul className="mt-2 space-y-2 text-xs text-slate-400">
            {runs.map((run, index) => (
              <li
                key={run.agent_run_id}
                className={`rounded border px-2 py-1 ${index === 0 ? "border-violet-700 bg-violet-950/20" : "border-slate-800"}`}
              >
                {index === 0 ? "Latest · " : ""}
                {run.created_at} · {run.status} · {run.strategy_id}
                {run.probability !== null ? ` · p=${run.probability}%` : ""}
                {run.source_request_ids_created.length > 0
                  ? ` · +${run.source_request_ids_created.length} req`
                  : ""}
                {(run.source_request_ids_reused ?? []).length > 0
                  ? ` · reused ${run.source_request_ids_reused.length}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-cyan-300">{message}</p> : null}
    </section>
  );
}
