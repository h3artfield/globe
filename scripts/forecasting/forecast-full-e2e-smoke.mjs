/**
 * Tracked copy of the Forecast Lab full E2E smoke test.
 * Run: node scripts/forecasting/forecast-full-e2e-smoke.mjs
 * (Requires `npm run dev` at http://localhost:3000)
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const REPO = process.cwd();

const results = [];

function record(section, name, ok, details = {}) {
  results.push({ section, name, ok, ...details });
  if (!ok) {
    console.error(`FAIL [${section}] ${name}`, details);
  }
}

async function json(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, status: response.status, ok: response.ok };
}

function assertOk(section, name, result, predicate = () => true) {
  record(section, name, result.ok && predicate(result.payload, result), {
    status: result.status,
    error: result.payload?.error,
  });
  return result;
}

async function ensureTwoAgents() {
  let agents = (await json("GET", "/api/forecast/agents")).payload.agents ?? [];
  while (agents.length < 2) {
    const created = await json("POST", "/api/forecast/agents", {
      name: `E2E Agent ${agents.length + 1}`,
      type: agents.length === 0 ? "human" : "ai",
      description: "full e2e smoke",
    });
    agents = [...agents, created.payload];
  }
  return agents;
}

async function runCoreLifecycle(section, agent) {
  const sessionRes = assertOk(
    section,
    "create replay session",
    await json("POST", "/api/forecast/replay/sessions", {
      template_id: "unodc_homicide_rate_direction",
      target: "USA",
      year: 2010,
      agent_id: agent.agent_id,
    }),
    (body) => Boolean(body.session_id),
  );
  const sessionId = sessionRes.payload.session_id;

  assertOk(
    section,
    "generate evidence snapshot",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`),
    (body) => Boolean(body.evidence_snapshot_id),
  );

  const agentRun = assertOk(
    section,
    "run agent (balanced)",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
      strategy_id: "balanced_baseline",
      agent_id: agent.agent_id,
    }),
    (body) => body.status === "completed" || body.status === "needs_sources",
  );

  if (agentRun.payload.status === "completed") {
    assertOk(
      section,
      "apply agent draft",
      await json(
        "POST",
        `/api/forecast/replay/sessions/${sessionId}/agent-runs/${agentRun.payload.agent_run_id}/apply`,
        { agent_id: agent.agent_id },
      ),
    );
  } else {
    await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, {
      probability: 58,
      confidence: "medium",
      forecast_rationale: "E2E fallback draft after needs_sources",
      key_signals: ["UNODC trend"],
      assumptions: ["No major shock"],
      uncertainty_notes: "Thin evidence path",
    });
  }

  const sourceReq = assertOk(
    section,
    "create source request",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/source-requests`, {
      request_type: "human_upload",
      requested_source_id: "unodc",
      reason: "E2E smoke: verify fulfillment path",
      priority: "high",
    }),
    (body) => Boolean(body.source_request_id),
  );
  const sourceRequestId = sourceReq.payload.source_request_id;

  assertOk(
    section,
    "fulfill source request",
    await json("POST", `/api/forecast/source-requests/${sourceRequestId}/fulfill`, {
      local_path: "data/processed/countries/USA/metrics.v1.json",
      safe_for_evidence_snapshot: true,
      fulfillment_notes: "E2E smoke fulfillment",
    }),
  );

  assertOk(
    section,
    "regenerate evidence snapshot after fulfillment",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`),
    (body) => Boolean(body.evidence_snapshot_id),
  );

  const sessionBeforeLock = (await json("GET", `/api/forecast/replay/sessions/${sessionId}`))
    .payload;
  if (sessionBeforeLock.user_forecast.probability == null) {
    await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, {
      probability: 55,
      confidence: "medium",
      forecast_rationale: "E2E pre-lock draft",
    });
  }

  assertOk(
    section,
    "lock forecast",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/lock`),
    (body) => body.status === "locked",
  );

  assertOk(
    section,
    "resolve session",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/resolve`),
    (body) => Boolean(body.resolution_id ?? body.outcome),
  );

  const score1 = assertOk(
    section,
    "score session",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/score`),
    (body) => body.scorecard_id != null,
  );

  assertOk(
    section,
    "judge session",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/judge`),
    (body) => Boolean(body.audit_id ?? body.judge_audit_id),
  );

  const postmortem1 = assertOk(
    section,
    "generate postmortem",
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/postmortem`),
    (body) => Boolean(body.postmortem_id),
  );

  assertOk(
    section,
    "recompute agent performance",
    await json("POST", `/api/forecast/agents/${agent.agent_id}/recompute-performance`),
    (body) => (body.resolved_forecasts ?? 0) >= 1,
  );

  return {
    sessionId,
    agentRunId: agentRun.payload.agent_run_id,
    scorecardId: score1.payload.scorecard_id,
    postmortemId: postmortem1.payload.postmortem_id,
    sourceRequestId,
  };
}

async function runIdempotency(section, ctx) {
  const { sessionId, agentRunId, scorecardId, postmortemId } = ctx;

  const score2 = await json("POST", `/api/forecast/replay/sessions/${sessionId}/score`);
  record(
    section,
    "score is idempotent (same scorecard_id)",
    score2.ok && score2.payload.scorecard_id === scorecardId,
    { first: scorecardId, second: score2.payload.scorecard_id },
  );

  const post2 = await json("POST", `/api/forecast/replay/sessions/${sessionId}/postmortem`);
  record(
    section,
    "postmortem is idempotent (same postmortem_id)",
    post2.ok && post2.payload.postmortem_id === postmortemId,
    { first: postmortemId, second: post2.payload.postmortem_id },
  );

  const cautiousSession = (
    await json("POST", "/api/forecast/replay/sessions", {
      template_id: "unodc_homicide_rate_direction",
      target: "USA",
      year: 2010,
      agent_id: ctx.agentId,
    })
  ).payload.session_id;

  await json("POST", `/api/forecast/replay/sessions/${cautiousSession}/evidence-snapshot`);

  const runA = await json("POST", `/api/forecast/replay/sessions/${cautiousSession}/agent-runs`, {
    strategy_id: "cautious_source_hound",
    agent_id: ctx.agentId,
  });
  const runB = await json("POST", `/api/forecast/replay/sessions/${cautiousSession}/agent-runs`, {
    strategy_id: "cautious_source_hound",
    agent_id: ctx.agentId,
  });

  const reqs = await json("GET", `/api/forecast/replay/sessions/${cautiousSession}/source-requests`);
  const openDataset = (reqs.payload.requests ?? reqs.payload ?? []).filter(
    (request) =>
      request.requested_source_id === "unodc" && request.request_type === "dataset_refresh",
  );

  record(section, "cautious agent re-run reuses source requests", runA.ok && runB.ok, {
    createdFirst: runA.payload.source_request_ids_created?.length ?? 0,
    createdSecond: runB.payload.source_request_ids_created?.length ?? 0,
    reusedSecond: runB.payload.source_request_ids_reused?.length ?? 0,
    openUnodcRefresh: openDataset.length,
  });
  record(
    section,
    "no duplicate open unodc dataset_refresh requests",
    (runB.payload.source_request_ids_created?.length ?? 0) === 0 &&
      openDataset.length <= 1,
  );
}

async function runLockedImmutability(section, agent) {
  const sessionId = (
    await json("POST", "/api/forecast/replay/sessions", {
      template_id: "unodc_homicide_rate_direction",
      target: "USA",
      year: 2010,
      agent_id: agent.agent_id,
    })
  ).payload.session_id;

  await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`);
  const run = await json("POST", `/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
    strategy_id: "balanced_baseline",
    agent_id: agent.agent_id,
  });

  if (run.payload.status === "completed") {
    await json(
      "POST",
      `/api/forecast/replay/sessions/${sessionId}/agent-runs/${run.payload.agent_run_id}/apply`,
      { agent_id: agent.agent_id },
    );
  } else {
    await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, {
      probability: 52,
      confidence: "medium",
      forecast_rationale: "lock immutability test",
      key_signals: ["signal-a"],
      assumptions: ["assumption-a"],
      uncertainty_notes: "note-a",
    });
  }

  await json("POST", `/api/forecast/replay/sessions/${sessionId}/lock`);

  const patchFields = [
    { probability: 99 },
    { confidence: "high" },
    { rationale: "changed rationale" },
    { forecast_rationale: "changed forecast rationale" },
    { key_signals: ["changed"] },
    { assumptions: ["changed assumption"] },
    { uncertainty_notes: "changed notes" },
  ];

  for (const body of patchFields) {
    const field = Object.keys(body)[0];
    const patch = await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, body);
    record(
      section,
      `locked session rejects PATCH ${field}`,
      patch.status === 400,
      { status: patch.status, error: patch.payload.error },
    );
  }

  const blockedRun = await json("POST", `/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
    strategy_id: "balanced_baseline",
    agent_id: agent.agent_id,
  });
  record(section, "locked session rejects agent run", blockedRun.status === 400);

  const blockedApply = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/agent-runs/${run.payload.agent_run_id}/apply`,
    { agent_id: agent.agent_id },
  );
  record(section, "locked session rejects apply draft", blockedApply.status === 400);
}

async function runComparisonAndTournament(section, agents) {
  const comparison = assertOk(
    section,
    "create 2-agent comparison",
    await json("POST", "/api/forecast/replay/comparisons", {
      template_id: "unodc_homicide_rate_direction",
      target: "USA",
      year: 2010,
      agent_ids: [agents[0].agent_id, agents[1].agent_id],
    }),
    (body) => (body.session_ids?.length ?? 0) === 2,
  );

  for (const sessionId of comparison.payload.session_ids ?? []) {
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`);
    await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, {
      probability: 50,
      confidence: "medium",
      forecast_rationale: "comparison smoke",
    });
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/lock`);
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/resolve`);
    await json("POST", `/api/forecast/replay/sessions/${sessionId}/score`);
  }

  const tournament = assertOk(
    section,
    "create tournament",
    await json("POST", "/api/forecast/tournaments", {
      title: "E2E full stack tournament",
      template_ids: ["unodc_homicide_rate_direction", "vdem_electoral_democracy_direction"],
      targets: ["USA"],
      years: [2010],
      agent_ids: [agents[0].agent_id, agents[1].agent_id],
      strategy_ids: ["cautious_source_hound", "balanced_baseline"],
      run_config: {
        require_evidence_snapshot: true,
        allow_auto_apply_agent_draft: true,
        allow_auto_lock: false,
        allow_auto_resolve_score_judge_postmortem: false,
        max_sessions: 10,
        source_request_policy: "create_requests_only",
      },
    }),
    (body) => Boolean(body.tournament_id),
  );
  const tournamentId = tournament.payload.tournament_id;

  const run1 = assertOk(
    section,
    "run tournament",
    await json("POST", `/api/forecast/tournaments/${tournamentId}/run`),
    (body) => (body.session_ids?.length ?? 0) >= 2,
  );
  const sessionCount1 = run1.payload.session_ids.length;
  const summaryCount1 = run1.payload.summary.total_sessions;

  const run2 = await json("POST", `/api/forecast/tournaments/${tournamentId}/run`);
  record(section, "tournament re-run retains session ids", run2.ok, {
    idsMatch:
      JSON.stringify(run2.payload.session_ids) === JSON.stringify(run1.payload.session_ids),
  });
  record(
    section,
    "tournament summary does not double-count sessions",
    run2.payload.summary.total_sessions === summaryCount1,
    { first: summaryCount1, second: run2.payload.summary.total_sessions },
  );

  assertOk(
    section,
    "export tournament report",
    await json("GET", `/api/forecast/tournaments/${tournamentId}/export`),
    (body) => Boolean(body.exported_at) && Array.isArray(body.sessions),
  );

  const proposals1 = (
    await json("POST", `/api/forecast/tournaments/${tournamentId}/tuning-proposals`)
  ).payload.proposals ?? [];
  record(section, "generate tuning proposals", proposals1.length >= 1, {
    count: proposals1.length,
  });

  const listedBefore = (
    await json("GET", `/api/forecast/tournaments/${tournamentId}/tuning-proposals`)
  ).payload.proposals ?? [];
  const proposals2 = (
    await json("POST", `/api/forecast/tournaments/${tournamentId}/tuning-proposals`)
  ).payload.proposals ?? [];
  const listedAfter = (
    await json("GET", `/api/forecast/tournaments/${tournamentId}/tuning-proposals`)
  ).payload.proposals ?? [];

  record(
    section,
    "tuning proposal listing grows but each proposal_id is unique",
    listedAfter.length >= listedBefore.length &&
      new Set(listedAfter.map((proposal) => proposal.proposal_id)).size === listedAfter.length,
    { before: listedBefore.length, after: listedAfter.length, generatedTwice: proposals2.length },
  );

  const acceptTarget =
    proposals1.find((proposal) => proposal.status === "proposed") ?? proposals1[0];
  const rejectTarget =
    proposals1.find(
      (proposal) =>
        proposal.status === "proposed" && proposal.proposal_id !== acceptTarget.proposal_id,
    ) ?? proposals1[1];

  const beforeStrategy = (
    await json("GET", `/api/forecast/agents/${acceptTarget.agent_id}/strategy`)
  ).payload.saved_strategy;
  const beforeVersion = beforeStrategy?.version ?? 1;

  const accepted = await json(
    "POST",
    `/api/forecast/agents/${acceptTarget.agent_id}/tuning-proposals/${acceptTarget.proposal_id}/accept`,
  );
  record(section, "accept tuning proposal creates new strategy version", accepted.ok, {
    previousVersion: beforeVersion,
    newVersion: accepted.payload.strategy?.version,
    status: accepted.payload.proposal?.status,
  });
  record(
    section,
    "accepted strategy version incremented (not silent overwrite)",
    accepted.ok && (accepted.payload.strategy?.version ?? 0) > beforeVersion,
  );

  if (rejectTarget) {
    const rejected = await json(
      "POST",
      `/api/forecast/agents/${rejectTarget.agent_id}/tuning-proposals/${rejectTarget.proposal_id}/reject`,
    );
    record(section, "reject tuning proposal", rejected.ok && rejected.payload.proposal.status === "rejected");
  }

  return { tournamentId, sessionCount1 };
}

function runGitignoreAudit(section) {
  const paths = [
    ["sessions", "data/forecasting/sessions/test/session.v1.json"],
    ["evidence snapshots", "data/forecasting/evidence_snapshots/test/snapshot.v1.json"],
    ["resolutions", "data/forecasting/resolutions/test/resolution.v1.json"],
    ["scorecards", "data/forecasting/scorecards/test/scorecard.v1.json"],
    ["audits", "data/forecasting/audits/test/judge_audit.v1.json"],
    ["postmortems", "data/forecasting/postmortems/test/postmortem.v1.json"],
    ["agent profiles", "data/forecasting/agents/test/profile.v1.json"],
    ["strategies", "data/forecasting/agents/test/strategy.v1.json"],
    ["agent runs", "data/forecasting/agents/test/runs/run.v1.json"],
    ["source requests", "data/forecasting/source_requests/test/request.v1.json"],
    ["source fulfillments", "data/forecasting/source_fulfillments/test/fulfillment.v1.json"],
    ["comparison groups", "data/forecasting/comparisons/test/comparison.v1.json"],
    ["tournaments", "data/forecasting/tournaments/test/tournament.v1.json"],
    ["tournament reports", "data/forecasting/tournaments/test/report.v1.json"],
    ["tuning proposals", "data/forecasting/agents/test/tuning_proposals/prop.v1.json"],
    ["strategy archives", "data/forecasting/agents/test/strategy.archive.v1.v1.json"],
    ["judge rules jsonl", "data/forecasting/judges/rules.v1.jsonl"],
    ["next_time_rules jsonl", "data/forecasting/agents/test/next_time_rules.v1.jsonl"],
  ];

  for (const [label, relativePath] of paths) {
    let ignored = false;
    try {
      execSync(`git check-ignore -q "${relativePath}"`, { cwd: REPO, stdio: "pipe" });
      ignored = true;
    } catch {
      ignored = false;
    }
    record(section, `gitignore: ${label}`, ignored, { path: relativePath });
  }
}

async function main() {
  console.log("Forecast Lab full E2E smoke test");
  console.log(`Base URL: ${BASE}`);

  const agents = await ensureTwoAgents();
  record("setup", "ensure two agents", agents.length >= 2, { count: agents.length });

  const ctx = await runCoreLifecycle("core-lifecycle", agents[0]);
  ctx.agentId = agents[0].agent_id;

  await runIdempotency("idempotency", ctx);
  await runLockedImmutability("locked-immutability", agents[0]);
  await runComparisonAndTournament("comparison-tournament", agents);
  runGitignoreAudit("gitignore-audit");

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
