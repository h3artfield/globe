import path from "node:path";
import type {
  ForecastTournament,
  TournamentExportReport,
  TournamentExportSessionSummary,
} from "@/types/forecasting";
import { listAgentRunsForSession } from "@/lib/forecasting/agentRunStore";
import { loadReplayJudgeAudit } from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayPostmortem } from "@/lib/forecasting/replayPostmortemStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";
import { listTuningProposalsForTournament } from "@/lib/forecasting/tuningProposalStore";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

function sessionArtifactPath(sessionId: string): string {
  return repoPath("data", "forecasting", "sessions", sessionId, "session.v1.json");
}

function evidenceSnapshotPath(sessionId: string, snapshotId: string | null): string | null {
  if (!snapshotId) {
    return null;
  }
  return repoPath("data", "forecasting", "evidence_snapshots", sessionId, `${snapshotId}.v1.json`);
}

function scorecardPath(sessionId: string): string {
  return repoPath("data", "forecasting", "scorecards", sessionId, "scorecard.v1.json");
}

function judgeAuditPath(sessionId: string): string {
  return repoPath("data", "forecasting", "audits", sessionId, "judge_audit.v1.json");
}

function postmortemPath(sessionId: string): string {
  return repoPath("data", "forecasting", "postmortems", sessionId, "postmortem.v1.json");
}

export async function buildTournamentExportReport(
  tournament: ForecastTournament,
): Promise<TournamentExportReport> {
  const sessions: TournamentExportSessionSummary[] = [];
  const scoreSummaries: TournamentExportReport["score_summaries"] = [];
  const judgeWarnings = new Set<string>();
  const sourceGaps = new Set<string>();

  for (const sessionId of tournament.session_ids) {
    const session = await loadReplaySession(sessionId);
    if (!session) {
      continue;
    }

    const runs = await listAgentRunsForSession(sessionId);
    const latestRun = runs[0];
    const scorecard = await loadReplayScorecard(sessionId);
    const audit = await loadReplayJudgeAudit(sessionId);
    const postmortem = await loadReplayPostmortem(sessionId);
    const requests = await listSourceRequestsForSession(sessionId);

    for (const request of requests) {
      if (request.status === "open") {
        sourceGaps.add(request.requested_source_id);
      }
    }
    for (const warning of audit?.warnings ?? []) {
      judgeWarnings.add(warning);
    }

    sessions.push({
      session_id: sessionId,
      template_id: session.template_id,
      target: session.target.target_id,
      agent_id: session.agent_id,
      status: session.status,
      probability: session.user_forecast.probability,
      brier_score: scorecard?.brier_score ?? null,
      direction_correct: scorecard?.direction_correct ?? null,
      agent_run_status: latestRun?.status ?? null,
      strategy_id: latestRun?.strategy_id ?? null,
      source_request_count: requests.length,
      artifact_paths: {
        session: sessionArtifactPath(sessionId),
        evidence_snapshot: evidenceSnapshotPath(sessionId, session.evidence_snapshot_id),
        scorecard: scorecard ? scorecardPath(sessionId) : null,
        judge_audit: audit ? judgeAuditPath(sessionId) : null,
        postmortem: postmortem ? postmortemPath(sessionId) : null,
      },
    });

    scoreSummaries.push({
      session_id: sessionId,
      brier_score: scorecard?.brier_score ?? null,
      outcome: scorecard?.outcome ?? null,
    });
  }

  const proposals = await listTuningProposalsForTournament(tournament.tournament_id);

  const report: TournamentExportReport = {
    exported_at: new Date().toISOString(),
    tournament,
    sessions,
    agent_summaries: Object.fromEntries(
      Object.entries(tournament.summary.average_brier_by_agent).map(([agentId, brier]) => [
        agentId,
        {
          average_brier: brier,
          direction_accuracy: tournament.summary.direction_accuracy_by_agent[agentId] ?? null,
          session_count: sessions.filter((item) => item.agent_id === agentId).length,
        },
      ]),
    ),
    template_summaries: Object.fromEntries(
      Object.entries(tournament.summary.average_brier_by_template).map(([templateId, brier]) => [
        templateId,
        {
          average_brier: brier,
          session_count: sessions.filter((item) => item.template_id === templateId).length,
        },
      ]),
    ),
    source_gaps: [...sourceGaps, ...tournament.summary.common_source_gaps],
    judge_warnings: [...judgeWarnings, ...tournament.summary.common_judge_warnings],
    score_summaries: scoreSummaries,
    strategy_tuning_suggestions: tournament.summary.strategy_tuning_suggestions,
    tuning_proposal_ids: proposals.map((proposal) => proposal.proposal_id),
  };

  return report;
}

export async function exportTournamentReport(
  tournament: ForecastTournament,
): Promise<TournamentExportReport> {
  const report = await buildTournamentExportReport(tournament);
  const reportPath = path.join(
    repoPath("data", "forecasting", "tournaments", tournament.tournament_id),
    "report.v1.json",
  );
  await writeJsonFile(reportPath, report);
  return report;
}
