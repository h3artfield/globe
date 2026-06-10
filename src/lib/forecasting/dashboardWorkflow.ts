import type {
  DashboardQuestionRow,
  DashboardSessionRow,
  DashboardWorkflowStep,
  DashboardWorkflowStepId,
} from "@/types/forecasting";

type SessionEnrichment = {
  news_record_count: number;
  has_evidence_assessment: boolean;
  has_planned_source_requests: boolean;
  has_scorecard: boolean;
  has_judge: boolean;
  has_postmortem: boolean;
  cautious_run_status: string | null;
  aggressive_run_status: string | null;
  latest_completed_run_id: string | null;
};

function step(
  stepId: DashboardWorkflowStepId,
  label: string,
  state: DashboardWorkflowStep["state"],
  blockedReason: string | null,
  lastResultSummary: string | null,
  sessionId: string | null,
): DashboardWorkflowStep {
  return {
    step_id: stepId,
    label,
    state,
    blocked_reason: blockedReason,
    last_result_summary: lastResultSummary,
    session_id: sessionId,
    session_url: sessionId ? `/forecast/replay/${sessionId}` : null,
  };
}

export function buildQuestionWorkflow(
  question: DashboardQuestionRow,
  session: DashboardSessionRow | null,
  enrichment: SessionEnrichment | null,
): DashboardWorkflowStep[] {
  const sessionId = session?.session_id ?? null;
  const isDraft = session?.status === "draft";
  const isLocked = session?.status === "locked";
  const isResolved = session?.status === "resolved";

  const createSession = step(
    "create_session",
    "Create Session",
    sessionId ? "completed" : "available",
    null,
    sessionId ? `Session ${sessionId} linked to ${question.source_market_id}.` : null,
    sessionId,
  );

  const findNews = (() => {
    if (!sessionId) {
      return step("find_news_evidence", "Find News Evidence", "blocked", "Create a session first.", null, null);
    }
    if ((enrichment?.news_record_count ?? 0) > 0) {
      return step(
        "find_news_evidence",
        "Find News Evidence",
        "completed",
        null,
        `${enrichment!.news_record_count} news record(s) in evidence snapshot.`,
        sessionId,
      );
    }
    if (!isDraft && !isLocked) {
      return step(
        "find_news_evidence",
        "Find News Evidence",
        "blocked",
        "Session must be draft or locked to attach news evidence.",
        null,
        sessionId,
      );
    }
    return step("find_news_evidence", "Find News Evidence", "available", null, null, sessionId);
  })();

  const assessEvidence = (() => {
    if (!sessionId) {
      return step("assess_evidence", "Assess Evidence", "blocked", "Create a session first.", null, null);
    }
    if (enrichment?.has_evidence_assessment) {
      return step(
        "assess_evidence",
        "Assess Evidence",
        "completed",
        null,
        session!.recommendation
          ? `Overall ${Math.round((session!.evidence_score ?? 0) * 100)}% · ${session!.recommendation}`
          : "Evidence assessment saved.",
        sessionId,
      );
    }
    return step("assess_evidence", "Assess Evidence", "available", null, null, sessionId);
  })();

  const planRequests = (() => {
    if (!sessionId) {
      return step("plan_source_requests", "Plan Source Requests", "blocked", "Create a session first.", null, null);
    }
    if (!isDraft) {
      return step(
        "plan_source_requests",
        "Plan Source Requests",
        "blocked",
        "Source planning is only allowed on draft sessions.",
        null,
        sessionId,
      );
    }
    if (enrichment?.has_planned_source_requests) {
      return step(
        "plan_source_requests",
        "Plan Source Requests",
        "completed",
        null,
        `${session!.open_source_request_count} open request(s); ${session!.source_gap_count} gap(s) assessed.`,
        sessionId,
      );
    }
    return step("plan_source_requests", "Plan Source Requests", "available", null, null, sessionId);
  })();

  const runCautiousAgent = (() => {
    if (!sessionId) {
      return step("run_cautious_agent", "Run Cautious Agent", "blocked", "Create a session first.", null, null);
    }
    if (!isDraft) {
      return step(
        "run_cautious_agent",
        "Run Cautious Agent",
        "blocked",
        "Agent runs are only allowed on draft sessions.",
        null,
        sessionId,
      );
    }
    if (!session?.agent_id) {
      return step(
        "run_cautious_agent",
        "Run Cautious Agent",
        "blocked",
        "Assign an agent to the session before running a strategy.",
        null,
        sessionId,
      );
    }
    if (enrichment?.cautious_run_status) {
      return step(
        "run_cautious_agent",
        "Run Cautious Agent",
        "completed",
        null,
        `Cautious run: ${enrichment.cautious_run_status}.`,
        sessionId,
      );
    }
    return step("run_cautious_agent", "Run Cautious Agent", "available", null, null, sessionId);
  })();

  const runAggressiveAgent = (() => {
    if (!sessionId) {
      return step("run_aggressive_agent", "Run Aggressive Agent", "blocked", "Create a session first.", null, null);
    }
    if (!isDraft) {
      return step(
        "run_aggressive_agent",
        "Run Aggressive Agent",
        "blocked",
        "Agent runs are only allowed on draft sessions.",
        null,
        sessionId,
      );
    }
    if (!session?.agent_id) {
      return step(
        "run_aggressive_agent",
        "Run Aggressive Agent",
        "blocked",
        "Assign an agent to the session before running a strategy.",
        null,
        sessionId,
      );
    }
    if (enrichment?.aggressive_run_status) {
      return step(
        "run_aggressive_agent",
        "Run Aggressive Agent",
        "completed",
        null,
        `Aggressive run: ${enrichment.aggressive_run_status}.`,
        sessionId,
      );
    }
    return step("run_aggressive_agent", "Run Aggressive Agent", "available", null, null, sessionId);
  })();

  const applyDraft = (() => {
    if (!sessionId) {
      return step("apply_draft", "Apply Draft", "blocked", "Create a session first.", null, null);
    }
    if (!isDraft) {
      return step("apply_draft", "Apply Draft", "blocked", "Apply draft requires a draft session.", null, sessionId);
    }
    if (session.probability != null && session.latest_agent_run_status === "completed") {
      return step(
        "apply_draft",
        "Apply Draft",
        "completed",
        null,
        `Forecast draft applied: p=${session.probability}% · ${session.confidence ?? "n/a"} confidence.`,
        sessionId,
      );
    }
    if (session.latest_agent_run_status !== "completed" && !enrichment?.latest_completed_run_id) {
      return step(
        "apply_draft",
        "Apply Draft",
        "blocked",
        session.latest_agent_run_status === "needs_sources"
          ? "Latest agent run needs more sources; fulfill gaps or run aggressive strategy."
          : "Run an agent to completion before applying a draft.",
        null,
        sessionId,
      );
    }
    return step("apply_draft", "Apply Draft", "available", null, null, sessionId);
  })();

  const lockForecast = (() => {
    if (!sessionId) {
      return step("lock_forecast", "Lock Forecast", "blocked", "Create a session first.", null, null);
    }
    if (isResolved || isLocked) {
      return step(
        "lock_forecast",
        "Lock Forecast",
        "completed",
        null,
        isResolved ? "Session resolved." : "Forecast locked.",
        sessionId,
      );
    }
    if ((session?.probability ?? null) == null) {
      return step(
        "lock_forecast",
        "Lock Forecast",
        "blocked",
        "Set a forecast probability (apply draft or enter manually) before locking.",
        null,
        sessionId,
      );
    }
    return step("lock_forecast", "Lock Forecast", "available", null, null, sessionId);
  })();

  const refreshMarket = (() => {
    if (!sessionId) {
      return step("refresh_market", "Refresh Market", "blocked", "Create a session first.", null, null);
    }
    if (question.last_refreshed_at) {
      return step(
        "refresh_market",
        "Refresh Market",
        "completed",
        null,
        `Last refreshed ${new Date(question.last_refreshed_at).toLocaleString()} · status ${session?.market_status ?? question.resolution_status}.`,
        sessionId,
      );
    }
    if (!isDraft && !isLocked) {
      return step(
        "refresh_market",
        "Refresh Market",
        "blocked",
        "Market refresh requires a draft or locked session.",
        null,
        sessionId,
      );
    }
    return step("refresh_market", "Refresh Market", "available", null, null, sessionId);
  })();

  const resolveFromMarket = (() => {
    if (!sessionId) {
      return step("resolve_from_market", "Resolve From Market", "blocked", "Create a session first.", null, null);
    }
    if (isResolved) {
      return step("resolve_from_market", "Resolve From Market", "completed", null, "Session resolved from market.", sessionId);
    }
    if (!isLocked) {
      return step(
        "resolve_from_market",
        "Resolve From Market",
        "blocked",
        "Lock the forecast before resolving from Polymarket market outcome.",
        null,
        sessionId,
      );
    }
    if (!session.resolvable_from_market) {
      return step(
        "resolve_from_market",
        "Resolve From Market",
        "blocked",
        "Market is not resolved yet. Refresh after the market closes.",
        null,
        sessionId,
      );
    }
    return step("resolve_from_market", "Resolve From Market", "available", null, null, sessionId);
  })();

  const scoreSession = (() => {
    if (!sessionId) {
      return step("score_session", "Score Session", "blocked", "Create a session first.", null, null);
    }
    if (enrichment?.has_scorecard) {
      return step("score_session", "Score Session", "completed", null, "Scorecard saved.", sessionId);
    }
    if (!isResolved) {
      return step(
        "score_session",
        "Score Session",
        "blocked",
        "Resolve the session before scoring.",
        null,
        sessionId,
      );
    }
    return step("score_session", "Score Session", "available", null, null, sessionId);
  })();

  const judgeSession = (() => {
    if (!sessionId) {
      return step("judge_session", "Judge Session", "blocked", "Create a session first.", null, null);
    }
    if (enrichment?.has_judge) {
      return step("judge_session", "Judge Session", "completed", null, "Judge audit saved.", sessionId);
    }
    if (!enrichment?.has_scorecard) {
      return step(
        "judge_session",
        "Judge Session",
        "blocked",
        "Score the session before running judge.",
        null,
        sessionId,
      );
    }
    return step("judge_session", "Judge Session", "available", null, null, sessionId);
  })();

  const postmortemSession = (() => {
    if (!sessionId) {
      return step("postmortem_session", "Postmortem", "blocked", "Create a session first.", null, null);
    }
    if (enrichment?.has_postmortem) {
      return step("postmortem_session", "Postmortem", "completed", null, "Postmortem saved.", sessionId);
    }
    if (!enrichment?.has_judge) {
      return step(
        "postmortem_session",
        "Postmortem",
        "blocked",
        "Run judge before generating postmortem.",
        null,
        sessionId,
      );
    }
    return step("postmortem_session", "Postmortem", "available", null, null, sessionId);
  })();

  return [
    createSession,
    findNews,
    assessEvidence,
    planRequests,
    runCautiousAgent,
    runAggressiveAgent,
    applyDraft,
    lockForecast,
    refreshMarket,
    resolveFromMarket,
    scoreSession,
    judgeSession,
    postmortemSession,
  ];
}
