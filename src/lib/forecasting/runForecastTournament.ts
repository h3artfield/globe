import type {
  ForecastTournament,
  TournamentSessionError,
} from "@/types/forecasting";
import { buildTournamentSummary } from "@/lib/forecasting/buildTournamentSummary";
import { buildReplayEvidenceSnapshot } from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { createReplaySession } from "@/lib/forecasting/replaySessionStore";
import { generateReplayPostmortem } from "@/lib/forecasting/generateReplayPostmortem";
import { recomputeAgentPerformance } from "@/lib/forecasting/recomputeAgentPerformance";
import { resolveReplaySession } from "@/lib/forecasting/resolveReplaySession";
import {
  applyAgentRunToSession,
  runForecastAgent,
} from "@/lib/forecasting/runForecastAgent";
import { runReplayJudge } from "@/lib/forecasting/runReplayJudge";
import { scoreReplaySession } from "@/lib/forecasting/scoreReplaySession";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { lockReplaySession } from "@/lib/forecasting/updateReplaySession";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";
import {
  buildRecommendedStrategyChanges,
  suggestStrategyTuning,
} from "@/lib/forecasting/suggestStrategyTuning";
import { loadTournament, saveTournament } from "@/lib/forecasting/tournamentStore";
import { extractPostmortemRules } from "@/lib/forecasting/extractPostmortemRules";

function strategyForAgent(tournament: ForecastTournament, agentIndex: number): string {
  return tournament.strategy_ids[agentIndex] ?? tournament.strategy_ids[0] ?? "balanced_baseline";
}

async function hasBlockingSourceGaps(sessionId: string): Promise<boolean> {
  const requests = await listSourceRequestsForSession(sessionId);
  return requests.some((request) => request.status === "open");
}

export async function runForecastTournament(tournamentId: string): Promise<ForecastTournament> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  const nextRunCount = (tournament.run_count ?? 0) + 1;

  if (
    tournament.session_ids.length > 0 &&
    (tournament.status === "completed" || tournament.status === "running")
  ) {
    const warnings = [
      ...tournament.warnings,
      `Idempotent re-run #${nextRunCount}: retained ${tournament.session_ids.length} existing session(s); no new sessions created.`,
    ];
    let updated: ForecastTournament = {
      ...tournament,
      run_count: nextRunCount,
      status: "completed",
      warnings,
    };
    if (tournament.run_config.allow_auto_resolve_score_judge_postmortem) {
      for (const sessionId of tournament.session_ids) {
        try {
          let session = await loadReplaySession(sessionId);
          if (!session) {
            continue;
          }
          if (session.status === "locked") {
            await resolveReplaySession(sessionId);
            session = await loadReplaySession(sessionId);
          }
          if (session?.status === "resolved") {
            await scoreReplaySession(sessionId);
            await runReplayJudge(sessionId);
            await generateReplayPostmortem(sessionId);
          }
        } catch {
          // per-session refresh is non-fatal
        }
      }
    }
    updated.summary = await buildTournamentSummary(updated);
    updated.summary.strategy_tuning_suggestions = suggestStrategyTuning(updated.summary);
    updated.summary.recommended_strategy_changes = buildRecommendedStrategyChanges(
      updated,
      updated.summary,
    );
    await saveTournament(updated);
    return updated;
  }

  const running: ForecastTournament = {
    ...tournament,
    status: "running",
    run_count: nextRunCount,
    session_ids: [],
    warnings: [],
    errors: [],
    summary: {
      ...tournament.summary,
      session_errors: [],
    },
  };
  await saveTournament(running);

  const sessionErrors: TournamentSessionError[] = [];
  const sessionIds: string[] = [];
  const warnings: string[] = [];
  let processed = 0;

  for (const templateId of tournament.template_ids) {
    for (const target of tournament.targets) {
      for (const year of tournament.years) {
        for (let agentIndex = 0; agentIndex < tournament.agent_ids.length; agentIndex += 1) {
          if (processed >= tournament.run_config.max_sessions) {
            warnings.push(`Stopped at max_sessions=${tournament.run_config.max_sessions}.`);
            break;
          }

          const agentId = tournament.agent_ids[agentIndex]!;
          const strategyId = strategyForAgent(tournament, agentIndex);

          try {
            const session = await createReplaySession({
              template_id: templateId,
              target,
              year,
              agent_id: agentId,
            });
            sessionIds.push(session.session_id);

            if (tournament.run_config.require_evidence_snapshot) {
              await buildReplayEvidenceSnapshot(session.session_id);
            }

            const agentRun = await runForecastAgent(session.session_id, strategyId, agentId);

            if (
              agentRun.status === "needs_sources" &&
              tournament.run_config.source_request_policy === "ignore_missing_sources"
            ) {
              warnings.push(
                `Session ${session.session_id} needs sources but policy ignores gaps.`,
              );
            }

            if (
              tournament.run_config.allow_auto_apply_agent_draft &&
              agentRun.status === "completed"
            ) {
              await applyAgentRunToSession(session.session_id, agentRun.agent_run_id, agentId);
            }

            const canLock =
              tournament.run_config.allow_auto_lock &&
              agentRun.status === "completed" &&
              (tournament.run_config.source_request_policy !== "require_fulfillment_before_lock" ||
                !(await hasBlockingSourceGaps(session.session_id)));

            if (canLock) {
              const draft = await loadReplaySession(session.session_id);
              if (draft?.user_forecast.probability != null) {
                await lockReplaySession(session.session_id);
              } else {
                warnings.push(`Skipped auto-lock for ${session.session_id}: no probability draft.`);
              }
            }

            if (tournament.run_config.allow_auto_resolve_score_judge_postmortem) {
              let locked = await loadReplaySession(session.session_id);
              if (locked?.status === "locked") {
                await resolveReplaySession(session.session_id);
                locked = await loadReplaySession(session.session_id);
              }
              if (locked?.status === "resolved") {
                await scoreReplaySession(session.session_id);
                await runReplayJudge(session.session_id);
                const postmortem = await generateReplayPostmortem(session.session_id);
                if (locked.agent_id) {
                  await extractPostmortemRules(locked, postmortem);
                }
              }
            }

            processed += 1;
          } catch (error) {
            sessionErrors.push({
              template_id: templateId,
              target,
              year,
              agent_id: agentId,
              strategy_id: strategyId,
              session_id: sessionIds.at(-1) ?? null,
              error: error instanceof Error ? error.message : String(error),
            });
            processed += 1;
          }
        }
      }
    }
  }

  const completed: ForecastTournament = {
    ...running,
    session_ids: sessionIds,
    status: sessionErrors.length > 0 && sessionIds.length === 0 ? "failed" : "completed",
    warnings,
    errors: sessionErrors.map((entry) => entry.error),
    summary: {
      ...running.summary,
      session_errors: sessionErrors,
    },
  };

  completed.summary = await buildTournamentSummary(completed);
  completed.summary.strategy_tuning_suggestions = suggestStrategyTuning(completed.summary);
  completed.summary.recommended_strategy_changes = buildRecommendedStrategyChanges(
    completed,
    completed.summary,
  );

  for (const agentId of tournament.agent_ids) {
    try {
      await recomputeAgentPerformance(agentId);
    } catch {
      warnings.push(`Failed to recompute performance for agent ${agentId}.`);
    }
  }

  await saveTournament(completed);
  return completed;
}

export async function scoreForecastTournament(tournamentId: string): Promise<ForecastTournament> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  for (const sessionId of tournament.session_ids) {
    try {
      let session = await loadReplaySession(sessionId);
      if (!session) {
        continue;
      }
      if (session.status === "locked") {
        await resolveReplaySession(sessionId);
        session = await loadReplaySession(sessionId);
      }
      if (session?.status === "resolved") {
        await scoreReplaySession(sessionId);
        await runReplayJudge(sessionId);
        await generateReplayPostmortem(sessionId);
      }
    } catch {
      // per-session scoring errors are non-fatal
    }
  }

  const updated: ForecastTournament = {
    ...tournament,
    summary: await buildTournamentSummary(tournament),
  };
  updated.summary.strategy_tuning_suggestions = suggestStrategyTuning(updated.summary);
  updated.summary.recommended_strategy_changes = buildRecommendedStrategyChanges(
    updated,
    updated.summary,
  );
  await saveTournament(updated);
  return updated;
}
