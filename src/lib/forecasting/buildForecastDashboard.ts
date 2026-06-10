import type {
  DashboardAgentRow,
  DashboardEmptyState,
  DashboardQuestionRow,
  DashboardQuestionWorkflow,
  DashboardSessionBucket,
  DashboardSessionRow,
  ForecastDashboardResponse,
  ForecastSourceRequest,
  ReplaySession,
} from "@/types/forecasting";
import { listRecentAgentRuns } from "@/lib/forecasting/agentRunStore";
import { getDashboardFetchModes } from "@/lib/forecasting/dashboardFetchModes";
import { buildQuestionWorkflow } from "@/lib/forecasting/dashboardWorkflow";
import { loadSessionEvidenceAssessment } from "@/lib/forecasting/evidence/evidenceAssessmentStore";
import { listForecastAgents } from "@/lib/forecasting/forecastAgentStore";
import { getReplayEvidenceSnapshot } from "@/lib/forecasting/buildReplayEvidenceSnapshot";
import { listFilteredSourceRequests } from "@/lib/forecasting/listFilteredSourceRequests";
import {
  listRecentMarketRefreshes,
  loadLatestMarketRefresh,
} from "@/lib/forecasting/polymarket/marketRefreshStore";
import { queryPolymarketQuestions } from "@/lib/forecasting/polymarket/questionStore";
import { loadReplayScorecard } from "@/lib/forecasting/replayScorecardStore";
import { loadReplayJudgeAudit } from "@/lib/forecasting/replayJudgeAuditStore";
import { loadReplayPostmortem } from "@/lib/forecasting/replayPostmortemStore";
import { listRecentReplaySessions } from "@/lib/forecasting/replaySessionStore";
import { listAgentRunsForSession } from "@/lib/forecasting/agentRunStore";
import { listSourceRequestsForSession } from "@/lib/forecasting/sourceRequestStore";

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

function buildEmptyStates(input: {
  questionCount: number;
  activeSessionCount: number;
  openRequestCount: number;
  agentRunCount: number;
  refreshCount: number;
}): DashboardEmptyState[] {
  const states: DashboardEmptyState[] = [];
  if (input.questionCount === 0) {
    states.push({
      id: "no_questions",
      message: "No Polymarket questions imported yet.",
      next_action: "Click Ingest Mock Polymarket Questions to load the local fixture queue.",
    });
  }
  if (input.activeSessionCount === 0) {
    states.push({
      id: "no_sessions",
      message: "No active forecast sessions yet.",
      next_action: "Select a question and run Create Session in the guided workflow.",
    });
  }
  if (input.openRequestCount === 0) {
    states.push({
      id: "no_open_requests",
      message: "No open source requests in the inbox.",
      next_action: "Run Assess Evidence and Plan Source Requests when evidence is thin.",
    });
  }
  if (input.agentRunCount === 0) {
    states.push({
      id: "no_agent_runs",
      message: "No agent runs recorded yet.",
      next_action: "Assign an agent to a session, then use Run Agent in the guided workflow.",
    });
  }
  if (input.refreshCount === 0) {
    states.push({
      id: "no_market_refreshes",
      message: "No Polymarket market refreshes logged yet.",
      next_action: "Use Refresh Market after creating a live Polymarket session.",
    });
  }
  return states;
}

export async function buildForecastDashboard(): Promise<ForecastDashboardResponse> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const operatorWarnings: string[] = [];
  const fetchModes = getDashboardFetchModes();

  for (const mode of fetchModes) {
    if (!mode.live_fetch_allowed) {
      operatorWarnings.push(`${mode.label}. ${mode.env_hint}`);
    }
  }

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

  if (questions.length === 0) {
    operatorWarnings.push("No imported Polymarket questions. Run mock ingest before testing.");
  }

  const sessionsByBucket: Record<DashboardSessionBucket, DashboardSessionRow[]> = {
    draft: [],
    locked: [],
    resolved: [],
    needs_sources: [],
    human_review: [],
  };

  const sessionByMarketId = new Map<string, DashboardSessionRow>();
  const sessionEnrichment = new Map<
    string,
    {
      news_record_count: number;
      has_evidence_assessment: boolean;
      has_planned_source_requests: boolean;
      has_scorecard: boolean;
      has_judge: boolean;
      has_postmortem: boolean;
      cautious_run_status: string | null;
      aggressive_run_status: string | null;
      latest_completed_run_id: string | null;
    }
  >();

  let sessions: ReplaySession[] = [];
  try {
    sessions = await listRecentReplaySessions(30);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to load replay sessions");
  }

  let needsAssessmentCount = 0;
  let lockedUnresolvedCount = 0;
  let resolvedUnscoredCount = 0;

  for (const session of sessions) {
    try {
      const [assessment, sessionRequests, runs, snapshot, scorecard, judge, postmortem] =
        await Promise.all([
        loadSessionEvidenceAssessment(session.session_id),
        listSourceRequestsForSession(session.session_id),
        session.agent_id
          ? listAgentRunsForSession(session.session_id)
          : Promise.resolve([]),
        getReplayEvidenceSnapshot(session.session_id),
        loadReplayScorecard(session.session_id),
        loadReplayJudgeAudit(session.session_id),
        loadReplayPostmortem(session.session_id),
      ]);

      const openRequestCount = sessionRequests.filter((request) => request.status === "open").length;
      const latestRun = runs[0] ?? null;
      const cautiousRun = runs.find((run) => run.strategy_id === "cautious_source_hound") ?? null;
      const aggressiveRun = runs.find((run) => run.strategy_id === "aggressive_pattern_matcher") ?? null;
      const latestCompletedRun =
        runs.find((run) => run.status === "completed") ?? null;
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

      const newsCount =
        (snapshot?.news_evidence_records?.length ?? 0) +
        (snapshot?.included_records ?? []).filter((record) => record.source_id === "gdelt_news_events")
          .length;

      sessionEnrichment.set(session.session_id, {
        news_record_count: newsCount,
        has_evidence_assessment: Boolean(assessment),
        has_planned_source_requests: session.source_request_ids.length > 0,
        has_scorecard: Boolean(scorecard),
        has_judge: Boolean(judge),
        has_postmortem: Boolean(postmortem),
        cautious_run_status: cautiousRun?.status ?? null,
        aggressive_run_status: aggressiveRun?.status ?? null,
        latest_completed_run_id: latestCompletedRun?.agent_run_id ?? null,
      });

      if (session.status === "draft" && !assessment) {
        needsAssessmentCount += 1;
      }
      if (session.status === "locked") {
        lockedUnresolvedCount += 1;
      }
      if (session.status === "resolved" && !scorecard) {
        resolvedUnscoredCount += 1;
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
        latest_agent_run_id: latestCompletedRun?.agent_run_id ?? latestRun?.agent_run_id ?? null,
        latest_agent_run_status: latestCompletedRun?.status ?? latestRun?.status ?? null,
        latest_agent_run_recommended_action:
          latestCompletedRun?.recommended_action ?? latestRun?.recommended_action ?? null,
      };

      row.bucket = classifySessionBucket(
        session,
        openRequestCount,
        row.latest_agent_run_status,
        row.latest_agent_run_recommended_action,
        row.recommendation,
      );
      sessionsByBucket[row.bucket].push(row);

      if (session.source_market_id) {
        const existing = sessionByMarketId.get(session.source_market_id);
        if (!existing || row.last_updated > existing.last_updated) {
          sessionByMarketId.set(session.source_market_id, row);
        }
      }
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

  if (openSourceRequests.length > 0) {
    operatorWarnings.push(
      `${openSourceRequests.length} open source request(s) need operator review in the inbox.`,
    );
  }
  if (needsAssessmentCount > 0) {
    operatorWarnings.push(
      `${needsAssessmentCount} draft session(s) have no evidence assessment yet.`,
    );
  }
  if (lockedUnresolvedCount > 0) {
    operatorWarnings.push(
      `${lockedUnresolvedCount} locked session(s) are waiting for market resolution or manual resolve.`,
    );
  }
  if (resolvedUnscoredCount > 0) {
    operatorWarnings.push(`${resolvedUnscoredCount} resolved session(s) have not been scored yet.`);
  }

  const recentRuns = await listRecentAgentRuns(40);
  const agents = await listForecastAgents();

  const agentRows: DashboardAgentRow[] = agents.map((agent) => {
    const agentSessions = sessions.filter((session) => session.agent_id === agent.agent_id);
    const resolvedSessions = agentSessions.filter((session) => session.status === "resolved");
    const agentRuns = recentRuns.filter((run) => run.agent_id === agent.agent_id);
    return {
      agent_id: agent.agent_id,
      agent_name: agent.name,
      agent_type: agent.type,
      resolved_forecasts: resolvedSessions.length,
      total_forecasts: agentSessions.length,
      average_brier_score: null,
      direction_accuracy: null,
      needs_sources_count: agentRuns.filter((run) => run.status === "needs_sources").length,
      recent_runs: agentRuns.slice(0, 5),
    };
  });

  const recentMarketRefreshes = await listRecentMarketRefreshes(15);

  const activeSessionCount = Object.values(sessionCounts).reduce((sum, count) => sum + count, 0);
  const emptyStates = buildEmptyStates({
    questionCount: questions.length,
    activeSessionCount,
    openRequestCount: openSourceRequests.length,
    agentRunCount: recentRuns.length,
    refreshCount: recentMarketRefreshes.length,
  });

  const questionWorkflows: DashboardQuestionWorkflow[] = questions.map((question) => {
    const session = sessionByMarketId.get(question.source_market_id) ?? null;
    const enrichment = session ? sessionEnrichment.get(session.session_id) ?? null : null;
    return {
      source_market_id: question.source_market_id,
      title: question.title,
      session_id: session?.session_id ?? null,
      steps: buildQuestionWorkflow(question, session, enrichment),
    };
  });

  if (openSourceRequests.length > 0) {
    warnings.push(`${openSourceRequests.length} open source request(s) awaiting operator action.`);
  }

  return {
    computed_at: new Date().toISOString(),
    fetch_modes: fetchModes,
    questions,
    question_workflows: questionWorkflows,
    sessions_by_bucket: sessionsByBucket,
    session_counts: sessionCounts,
    open_source_requests: openSourceRequests.slice(0, 50),
    agents: agentRows,
    recent_market_refreshes: recentMarketRefreshes,
    empty_states: emptyStates,
    operator_warnings: operatorWarnings,
    warnings,
    errors,
  };
}
