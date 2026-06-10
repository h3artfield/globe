"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CreateForecastTournamentRequest,
  ForecastAgentProfile,
  ForecastTournament,
  ReplayTemplate,
  TournamentRunConfig,
} from "@/types/forecasting";
import { ForecastNav } from "@/components/ForecastNav";

export function ForecastTournamentsPageClient() {
  const [tournaments, setTournaments] = useState<ForecastTournament[]>([]);
  const [templates, setTemplates] = useState<ReplayTemplate[]>([]);
  const [agents, setAgents] = useState<ForecastAgentProfile[]>([]);
  const [title, setTitle] = useState("Historical replay tournament");
  const [templateId, setTemplateId] = useState("unodc_homicide_rate_direction");
  const [target, setTarget] = useState("USA");
  const [year, setYear] = useState(2010);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    "cautious_source_hound",
    "balanced_baseline",
  ]);
  const [autoLock, setAutoLock] = useState(false);
  const [autoScore, setAutoScore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("");

  const loadData = useCallback(async () => {
    const [tournamentRes, templateRes, agentRes] = await Promise.all([
      fetch("/api/forecast/tournaments"),
      fetch("/api/forecast/templates"),
      fetch("/api/forecast/agents"),
    ]);
    const tournamentPayload = (await tournamentRes.json()) as { tournaments: ForecastTournament[] };
    const templatePayload = (await templateRes.json()) as { templates: ReplayTemplate[] };
    const agentPayload = (await agentRes.json()) as { agents: ForecastAgentProfile[] };
    setTournaments(tournamentPayload.tournaments ?? []);
    setTemplates(templatePayload.templates ?? []);
    setAgents(agentPayload.agents ?? []);
    if (!activeId && tournamentPayload.tournaments?.[0]) {
      setActiveId(tournamentPayload.tournaments[0].tournament_id);
    }
    if (agentPayload.agents?.length && selectedAgents.length === 0) {
      setSelectedAgents(agentPayload.agents.slice(0, 2).map((agent) => agent.agent_id));
    }
  }, [activeId, selectedAgents.length]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createTournament() {
    setError(null);
    setMessage(null);
    if (selectedAgents.length === 0) {
      setError("Select at least one agent.");
      return;
    }
    const body: CreateForecastTournamentRequest = {
      title,
      template_ids: [templateId],
      targets: [target],
      years: [year],
      agent_ids: selectedAgents,
      strategy_ids: selectedStrategies.slice(0, selectedAgents.length),
      run_config: {
        require_evidence_snapshot: true,
        allow_auto_apply_agent_draft: true,
        allow_auto_lock: autoLock,
        allow_auto_resolve_score_judge_postmortem: autoScore,
        max_sessions: 20,
        source_request_policy: "create_requests_only",
      } satisfies Partial<TournamentRunConfig>,
    };
    const response = await fetch("/api/forecast/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as ForecastTournament & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Create failed");
      return;
    }
    setMessage(`Tournament created: ${payload.tournament_id}`);
    setActiveId(payload.tournament_id);
    await loadData();
  }

  async function runTournament(id: string) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/forecast/tournaments/${id}/run`, { method: "POST" });
    const payload = (await response.json()) as ForecastTournament & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Run failed");
      return;
    }
    setMessage(`Tournament run completed: ${payload.session_ids.length} sessions.`);
    await loadData();
  }

  async function scoreTournament(id: string) {
    setError(null);
    const response = await fetch(`/api/forecast/tournaments/${id}/score`, { method: "POST" });
    const payload = (await response.json()) as ForecastTournament & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Score failed");
      return;
    }
    setMessage("Tournament scored.");
    await loadData();
  }

  const active = tournaments.find((item) => item.tournament_id === activeId) ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Forecast Lab</p>
              <h1 className="mt-2 text-2xl font-bold">Historical Tournaments</h1>
              <p className="mt-2 text-sm text-slate-400">
                Batch-evaluate agents across replay questions with conservative defaults (no auto-lock
                unless enabled).
              </p>
            </div>
            <ForecastNav />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Create tournament</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm sm:col-span-2"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
            <select
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              onChange={(event) => setTemplateId(event.target.value)}
              value={templateId}
            >
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.template_id}
                </option>
              ))}
            </select>
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              onChange={(event) => setTarget(event.target.value.toUpperCase())}
              value={target}
            />
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              onChange={(event) => setYear(Number(event.target.value))}
              type="number"
              value={year}
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input checked={autoLock} onChange={(e) => setAutoLock(e.target.checked)} type="checkbox" />
              Allow auto-lock (explicit opt-in)
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input checked={autoScore} onChange={(e) => setAutoScore(e.target.checked)} type="checkbox" />
              Auto resolve/score/judge/postmortem after lock
            </label>
          </div>
          <button
            type="button"
            className="mt-3 rounded border border-cyan-700 px-4 py-2 text-sm"
            onClick={createTournament}
          >
            Create tournament
          </button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <h2 className="text-lg font-semibold">Tournaments ({tournaments.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tournaments.map((tournament) => (
              <li
                key={tournament.tournament_id}
                className="rounded border border-slate-800 bg-slate-900/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    className="font-medium text-cyan-200 hover:text-cyan-100"
                    href={`/forecast/tournaments/${tournament.tournament_id}`}
                  >
                    {tournament.title} · {tournament.status}
                  </Link>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-violet-700 px-2 py-1 text-xs"
                      onClick={() => runTournament(tournament.tournament_id)}
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      className="rounded border border-emerald-700 px-2 py-1 text-xs"
                      onClick={() => scoreTournament(tournament.tournament_id)}
                    >
                      Score
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {tournament.session_ids.length} sessions · needs_sources=
                  {tournament.summary.needs_sources_sessions}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {active ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Summary · {active.tournament_id}</h2>
            <pre className="mt-3 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              {JSON.stringify(active.summary, null, 2)}
            </pre>
            {active.summary.strategy_tuning_suggestions.length > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-slate-300">
                {active.summary.strategy_tuning_suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <ul className="mt-3 space-y-1 text-xs">
              {active.session_ids.map((sessionId) => (
                <li key={sessionId}>
                  <Link className="text-cyan-300 hover:text-cyan-100" href={`/forecast/replay/${sessionId}`}>
                    {sessionId}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
      </div>
    </main>
  );
}
