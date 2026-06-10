"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  ForecastAgentStrategy,
  ForecastStrategyTuningProposal,
  ForecastTournament,
  ReplaySession,
  TournamentExportReport,
} from "@/types/forecasting";
import { applyProposedChangesToStrategy } from "@/lib/forecasting/strategyTuningUtils";
import { getBuiltinAgentStrategy } from "@/lib/forecasting/builtInAgentStrategies";
import { ForecastNav } from "@/components/ForecastNav";

type SessionRow = {
  session: ReplaySession;
  agentRunStatus: string | null;
  strategyId: string | null;
};

function strategyPreview(
  agentId: string,
  strategyId: string,
  saved: ForecastAgentStrategy | null,
  changes: ForecastStrategyTuningProposal["proposed_changes"],
): { current: ForecastAgentStrategy; proposed: ForecastAgentStrategy } {
  const base = saved ?? getBuiltinAgentStrategy(strategyId)!;
  return {
    current: { ...base, agent_id: agentId },
    proposed: applyProposedChangesToStrategy({ ...base, agent_id: agentId }, changes),
  };
}

export function ForecastTournamentDetailPageClient({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const [tournament, setTournament] = useState<ForecastTournament | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [proposals, setProposals] = useState<ForecastStrategyTuningProposal[]>([]);
  const [savedStrategies, setSavedStrategies] = useState<Record<string, ForecastAgentStrategy | null>>(
    {},
  );
  const [exportReport, setExportReport] = useState<TournamentExportReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    const tournamentRes = await fetch(`/api/forecast/tournaments/${tournamentId}`);
    if (!tournamentRes.ok) {
      setError("Tournament not found");
      return;
    }
    const tournamentPayload = (await tournamentRes.json()) as ForecastTournament;
    setTournament(tournamentPayload);

    const [proposalRes, ...sessionResponses] = await Promise.all([
      fetch(`/api/forecast/tournaments/${tournamentId}/tuning-proposals`),
      ...tournamentPayload.session_ids.map((sessionId) =>
        fetch(`/api/forecast/replay/sessions/${sessionId}`),
      ),
    ]);
    const proposalPayload = (await proposalRes.json()) as {
      proposals: ForecastStrategyTuningProposal[];
    };
    setProposals(proposalPayload.proposals ?? []);

    const sessionRows: SessionRow[] = [];
    for (let index = 0; index < tournamentPayload.session_ids.length; index += 1) {
      const sessionId = tournamentPayload.session_ids[index]!;
      const sessionRes = sessionResponses[index];
      if (!sessionRes?.ok) {
        continue;
      }
      const session = (await sessionRes.json()) as ReplaySession;
      const runsRes = await fetch(`/api/forecast/replay/sessions/${sessionId}/agent-runs`);
      const runsPayload = (await runsRes.json()) as {
        runs: Array<{ status: string; strategy_id: string }>;
      };
      sessionRows.push({
        session,
        agentRunStatus: runsPayload.runs?.[0]?.status ?? null,
        strategyId: runsPayload.runs?.[0]?.strategy_id ?? null,
      });
    }
    setSessions(sessionRows);

    const strategyMap: Record<string, ForecastAgentStrategy | null> = {};
    for (const agentId of tournamentPayload.agent_ids) {
      const strategyRes = await fetch(`/api/forecast/agents/${agentId}/strategy`);
      if (strategyRes.ok) {
        const payload = (await strategyRes.json()) as { saved_strategy: ForecastAgentStrategy | null };
        strategyMap[agentId] = payload.saved_strategy;
      }
    }
    setSavedStrategies(strategyMap);
  }, [tournamentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function exportReportAction() {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/forecast/tournaments/${tournamentId}/export`);
    const payload = (await response.json()) as TournamentExportReport & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Export failed");
      return;
    }
    setExportReport(payload);
    setMessage("Export report generated and saved locally.");
  }

  async function generateProposals() {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/forecast/tournaments/${tournamentId}/tuning-proposals`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      proposals: ForecastStrategyTuningProposal[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error ?? "Proposal generation failed");
      return;
    }
    setProposals(payload.proposals ?? []);
    setMessage(`Generated ${payload.proposals?.length ?? 0} tuning proposal(s).`);
    await loadData();
  }

  async function acceptProposal(proposal: ForecastStrategyTuningProposal) {
    setError(null);
    const response = await fetch(
      `/api/forecast/agents/${proposal.agent_id}/tuning-proposals/${proposal.proposal_id}/accept`,
      { method: "POST" },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Accept failed");
      return;
    }
    setMessage(`Proposal ${proposal.proposal_id} accepted — new strategy version created.`);
    await loadData();
  }

  async function rejectProposal(proposal: ForecastStrategyTuningProposal) {
    setError(null);
    const response = await fetch(
      `/api/forecast/agents/${proposal.agent_id}/tuning-proposals/${proposal.proposal_id}/reject`,
      { method: "POST" },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Reject failed");
      return;
    }
    setMessage(`Proposal ${proposal.proposal_id} rejected.`);
    await loadData();
  }

  if (!tournament) {
    return <p className="p-6 text-white">{error ?? "Loading tournament…"}</p>;
  }

  const summary = tournament.summary;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Tournament review</p>
              <h1 className="mt-2 text-2xl font-bold">{tournament.title}</h1>
              <p className="mt-2 text-sm text-slate-400">
                {tournament.tournament_id} · {tournament.status} · run_count={tournament.run_count}
              </p>
              <Link className="mt-2 inline-block text-sm text-cyan-300 hover:text-cyan-100" href="/forecast/tournaments">
                ← All tournaments
              </Link>
            </div>
            <ForecastNav />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-violet-700 px-3 py-1.5 text-sm"
              onClick={exportReportAction}
            >
              Generate Export Report
            </button>
            <button
              type="button"
              className="rounded border border-amber-700 px-3 py-1.5 text-sm"
              onClick={generateProposals}
            >
              Generate Strategy Tuning Proposals
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <h2 className="text-lg font-semibold">Config</h2>
          <pre className="mt-2 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
            {JSON.stringify(
              {
                template_ids: tournament.template_ids,
                targets: tournament.targets,
                years: tournament.years,
                agent_ids: tournament.agent_ids,
                strategy_ids: tournament.strategy_ids,
                run_config: tournament.run_config,
              },
              null,
              2,
            )}
          </pre>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <h2 className="text-lg font-semibold">Session grid ({sessions.length})</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2">Session</th>
                  <th className="p-2">Template</th>
                  <th className="p-2">Target</th>
                  <th className="p-2">Agent</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Run</th>
                  <th className="p-2">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(({ session, agentRunStatus, strategyId }) => (
                  <tr key={session.session_id} className="border-t border-slate-800">
                    <td className="p-2">
                      <Link className="text-cyan-300" href={`/forecast/replay/${session.session_id}`}>
                        {session.session_id}
                      </Link>
                    </td>
                    <td className="p-2">{session.template_id}</td>
                    <td className="p-2">{session.target.target_id}</td>
                    <td className="p-2">{session.agent_id ?? "—"}</td>
                    <td className="p-2">{session.status}</td>
                    <td className="p-2">{agentRunStatus ?? "—"}</td>
                    <td className="p-2">{strategyId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Agent results</h2>
            <pre className="mt-2 text-xs text-slate-400">
              {JSON.stringify(summary.average_brier_by_agent, null, 2)}
            </pre>
            <p className="mt-2 text-xs text-slate-500">Direction accuracy</p>
            <pre className="text-xs text-slate-400">
              {JSON.stringify(summary.direction_accuracy_by_agent, null, 2)}
            </pre>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Template results</h2>
            <pre className="mt-2 text-xs text-slate-400">
              {JSON.stringify(summary.average_brier_by_template, null, 2)}
            </pre>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Source gaps</h2>
            <ul className="mt-2 list-disc pl-5 text-slate-300">
              {summary.common_source_gaps.length === 0 ? (
                <li className="text-slate-500">None recorded</li>
              ) : (
                summary.common_source_gaps.map((gap) => <li key={gap}>{gap}</li>)
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Judge warnings</h2>
            <ul className="mt-2 list-disc pl-5 text-slate-300">
              {summary.common_judge_warnings.length === 0 ? (
                <li className="text-slate-500">None recorded</li>
              ) : (
                summary.common_judge_warnings.map((warning) => <li key={warning}>{warning}</li>)
              )}
            </ul>
          </section>
        </div>

        {summary.session_errors.length > 0 ? (
          <section className="rounded-2xl border border-rose-900 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold text-rose-300">Failed sessions</h2>
            <ul className="mt-2 list-disc pl-5 text-rose-200">
              {summary.session_errors.map((item) => (
                <li key={`${item.template_id}-${item.target}-${item.year}-${item.agent_id}`}>
                  {item.template_id}/{item.target}/{item.year} · {item.agent_id}: {item.error}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <h2 className="text-lg font-semibold">Strategy tuning suggestions (display only)</h2>
          <ul className="mt-2 list-disc pl-5 text-slate-300">
            {summary.strategy_tuning_suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
          <h2 className="text-lg font-semibold">Tuning proposals ({proposals.length})</h2>
          {proposals.length === 0 ? (
            <p className="mt-2 text-slate-500">No proposals yet. Generate to review explicit changes.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {proposals.map((proposal) => {
                const preview = strategyPreview(
                  proposal.agent_id,
                  proposal.strategy_id,
                  savedStrategies[proposal.agent_id] ?? null,
                  proposal.proposed_changes,
                );
                return (
                  <li
                    key={proposal.proposal_id}
                    className="rounded border border-slate-800 bg-slate-900/50 p-4"
                  >
                    <p className="font-medium text-cyan-200">
                      {proposal.proposal_id} · {proposal.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      agent={proposal.agent_id} · strategy={proposal.strategy_id}
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-slate-300">
                      {proposal.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase text-slate-500">Current strategy</p>
                        <pre className="mt-1 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-2 text-xs text-slate-400">
                          {JSON.stringify(preview.current, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500">Proposed strategy</p>
                        <pre className="mt-1 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-2 text-xs text-emerald-300/80">
                          {JSON.stringify(preview.proposed, null, 2)}
                        </pre>
                      </div>
                    </div>
                    {proposal.status === "proposed" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="rounded border border-emerald-700 px-3 py-1 text-xs"
                          onClick={() => acceptProposal(proposal)}
                        >
                          Accept (creates new version)
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-700 px-3 py-1 text-xs"
                          onClick={() => rejectProposal(proposal)}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {exportReport ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold">Export report preview</h2>
            <p className="mt-1 text-xs text-slate-500">exported_at={exportReport.exported_at}</p>
            <pre className="mt-2 max-h-96 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
              {JSON.stringify(exportReport, null, 2)}
            </pre>
          </section>
        ) : null}

        {tournament.warnings.length > 0 ? (
          <section className="rounded-2xl border border-amber-900 bg-slate-950/70 p-5 text-sm">
            <h2 className="text-lg font-semibold text-amber-300">Run warnings</h2>
            <ul className="mt-2 list-disc pl-5 text-amber-100">
              {tournament.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
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
