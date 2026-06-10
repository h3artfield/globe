import type {
  DashboardAgentRow,
  DashboardQuestionRow,
  DashboardSessionBucket,
  DashboardSessionRow,
  ForecastDashboardResponse,
  ForecastSourceRequest,
  ReplaySession,
} from "@/types/forecasting";
import { listRecentAgentRuns } from "@/lib/forecasting/agentRunStore";
import { loadSessionEvidenceAssessment } from "@/lib/forecasting/evidence/evidenceAssessmentStore";
import { listForecastAgents } from "@/lib/forecasting/forecastAgentStore";
import { buildLeaderboard } from "@/lib/forecasting/buildLeaderboard";
import { listFilteredSourceRequests } from "@/lib/forecasting/listFilteredSourceRequests";
import {
  listRecentMarketRefreshes,
  loadLatestMarketRefresh,
} from "@/lib/forecasting/polymarket/marketRefreshStore";
import { queryPolymarketQuestions } from "@/lib/forecasting/polymarket/questionStore";
import { listReplaySessions } from "@/lib/forecasting/replaySessionStore";
import { listAgentRunsForSession } from "@/lib/forecasting/agentRunStore";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";

const EMPTY_BUCKETS: Record<DashboardSessionBucket, DashboardSessionRow[]> = {
  draft: [],
  locked: [],
  resolved: [],
  needs_sources: [],
  human_review: [],
};

function sessionLastUpdated(session: ReplaySession): string {
  const audit = session.audit_trail.at(-1);
  return audit?.at ?? session.locked_at ?? session.created_at;
}

function classifySessionBucket(
  session: ReplaySession,
  openRequestCount: number,
  latestRunStatus: DashboardSessionRow["latest_agent_run_status"],
  latestRunAction: DashboardSessionRow["latest_agent_run_recommended_action"],
  recommendation: DashboardSessionRow["recommendation"],
): DashboardSessionBucket {
  if (session.status === "resolved") {
    return "resolved";
  }
  if (openRequestCount > 0 || latestRunStatus === "needs_sources") {
    return "needs_sources";
  }
  if (recommendation === "human_review" || latestRunAction === "human_review") {
    return "human_review";
  }
  if (session.status === "locked") {
    return "locked";
  }
  return "draft";
}

export async function buildForecastDashboard(): Promise<ForecastDashboardResponse> {
  const warnings: string[] = [];
  const errors: string[] = [];

  let questions: DashboardQuestionRow[] = [];
  try {
    questions = queryPolymarketQuestions({ sort: "volume", limit: 50 }).map((question) => ({
      source_market_id: question.source_market_id,
      title: question.title,
      category: question.category,
      implied_probability: question.implied_probability,
      volume: question.volume,
      liquidity: question.liquidity,
      end_date: question.end_date,
      resolution_status: question.resolution_status,
      source_url: question.source_url,
      last_refreshed_at: question.last_refreshed_at ?? null,
    }));
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to load Polymarket question queue",
    );
  }

  const sessionsByBucket: Record<DashboardSessionBucket, DashboardSessionRow[]> = {
    draft: [],
    locked: [],
    resolved: [],
    needs_sources: [],
    human_review: [],
  };

  let sessions: ReplaySession[] = [];
  try {
    sessions = (await listReplaySessions()).slice(0, 100);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to load replay sessions");
  }

  for (const session of sessions) {
    try {
      const [assessment, sessionRequests, runs] = await Promise.all([
        loadSessionEvidenceAssessment(session.session_id),
        listSourceRequestsForSession(session.session_id),
        session.agent_id
          ? listAgentRunsForSession(session.session_id)
          : Promise.resolve([]),
      ]);

      const openRequestCount = sessionRequests.filter((request) => request.status === "open").length;
      const latestRun = runs[0] ?? null;
      let marketStatus: DashboardSessionRow["market_status"] = null;
      let resolvableFromMarket = false;

      if (session.source_market_id) {
        const refresh = await loadLatestMarketRefresh(session.source_market_id);
        marketStatus = refresh?.market_status ?? refresh?.resolution_status ?? null;
        resolvableFromMarket =
          session.status === "locked" &&
          (refresh?.resolution_status === "resolved" || refresh?.market_status === "resolved") &&
          Boolean(refresh?.winning_outcome);
      }

      const row: DashboardSessionRow = {
        session_id: session.session_id,
        bucket: "draft",
        status: session.status,
        question_text: session.question_text,
        template_id: session.template_id,
        agent_id: session.agent_id,
        agent_name: session.agent_name,
        probability: session.user_forecast.probability,
        confidence: session.user_forecast.confidence,
        evidence_score: assessment?.scores.overall_evidence_score ?? null,
        recommendation: assessment?.recommendation ?? null,
        market_status: marketStatus,
        source_gap_count: assessment?.source_gaps.length ?? 0,
        open_source_request_count: openRequestCount,
        last_updated: sessionLastUpdated(session),
        forecast_mode: session.forecast_mode,
        external_source: session.external_source,
        source_market_id: session.source_market_id,
        resolvable_from_market: resolvableFromMarket,
        latest_agent_run_id: latestRun?.agent_run_id ?? null,
        latest_agent_run_status: latestRun?.status ?? null,
        latest_agent_run_recommended_action: latestRun?.recommended_action ?? null,
      };

      row.bucket = classifySessionBucket(
        session,
        openRequestCount,
        row.latest_agent_run_status,
        row.latest_agent_run_recommended_action,
        row.recommendation,
      );
      sessionsByBucket[row.bucket].push(row);
    } catch (error) {
      warnings.push(
        `Session ${session.session_id}: ${error instanceof Error ? error.message : "enrichment failed"}`,
      );
    }
  }

  const sessionCounts = Object.fromEntries(
    (Object.keys(sessionsByBucket) as DashboardSessionBucket[]).map((bucket) => [
      bucket,
      sessionsByBucket[bucket].length,
    ]),
  ) as Record<DashboardSessionBucket, number>;

  let openSourceRequests: ForecastSourceRequest[] = [];
  try {
    openSourceRequests = await listFilteredSourceRequests({ status: "open" });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to load open source requests");
  }

  const recentRuns = await listRecentAgentRuns(40);
  const leaderboard = await buildLeaderboard();
  const agents = await listForecastAgents();

  const agentRows: DashboardAgentRow[] = agents.map((agent) => {
    const entry = leaderboard.entries.find((item) => item.agent_id === agent.agent_id);
    const agentRuns = recentRuns.filter((run) => run.agent_id === agent.agent_id);
    return {
      agent_id: agent.agent_id,
      agent_name: agent.name,
      agent_type: agent.type,
      resolved_forecasts: entry?.resolved_forecasts ?? 0,
      total_forecasts: entry?.total_forecasts ?? 0,
      average_brier_score: entry?.average_brier_score ?? null,
      direction_accuracy: entry?.direction_accuracy ?? null,
      needs_sources_count: agentRuns.filter((run) => run.status === "needs_sources").length,
      recent_runs: agentRuns.slice(0, 5),
    };
  });

  const recentMarketRefreshes = await listRecentMarketRefreshes(15);

  if (questions.length === 0) {
    warnings.push("No imported Polymarket questions in local index. Run mock ingest from dashboard.");
  }
  if (openSourceRequests.length > 0) {
    warnings.push(`${openSourceRequests.length} open source request(s) awaiting operator action.`);
  }

  return {
    computed_at: new Date().toISOString(),
    questions,
    sessions_by_bucket: sessionsByBucket,
    session_counts: sessionCounts,
    open_source_requests: openSourceRequests.slice(0, 50),
    agents: agentRows,
    recent_market_refreshes: recentMarketRefreshes,
    warnings,
    errors,
  };
}
