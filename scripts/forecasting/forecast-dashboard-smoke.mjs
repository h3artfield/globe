/**
 * Forecast Lab operator dashboard smoke test.
 * Run: npm run forecast:dashboard-smoke
 * (Requires `npm run dev`; set FORECAST_SMOKE_BASE if not on :3000)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

process.env.POLYMARKET_USE_MOCK = "true";
process.env.POLYMARKET_ALLOW_LIVE_FETCH = "false";
process.env.GDELT_USE_MOCK = "true";
process.env.GDELT_ALLOW_LIVE_FETCH = "false";

const BASE = process.env.FORECAST_SMOKE_BASE ?? "http://localhost:3000";
const REPO = process.cwd();

const results = [];

function record(name, ok, details = {}) {
  results.push({ name, ok, ...details });
  if (!ok) {
    console.error(`FAIL ${name}`, details);
  }
}

async function json(method, urlPath, body) {
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, status: response.status, ok: response.ok };
}

async function ensureAgent() {
  const agents = (await json("GET", "/api/forecast/agents")).payload.agents ?? [];
  if (agents.length > 0) {
    return agents[0];
  }
  const created = await json("POST", "/api/forecast/agents", {
    name: "Dashboard Smoke Agent",
    type: "ai",
    description: "dashboard smoke",
  });
  return created.payload;
}

function runGitignoreAudit() {
  const paths = [
    "data/forecasting/question_sources/polymarket/market_refreshes.v1.jsonl",
    "data/forecasting/question_sources/polymarket/questions.v1.jsonl",
    "data/forecasting/evidence_assessments/test/assessment.v1.json",
    "data/forecasting/sessions/test/session.v1.json",
  ];
  for (const relativePath of paths) {
    let ignored = false;
    try {
      execSync(`git check-ignore -q "${relativePath}"`, { cwd: REPO, stdio: "pipe" });
      ignored = true;
    } catch {
      ignored = false;
    }
    record(`gitignore ${relativePath}`, ignored);
  }
}

async function main() {
  console.log("Forecast Lab dashboard smoke test");

  const emptyDashboard = await json("GET", "/api/forecast/dashboard");
  record("dashboard loads", emptyDashboard.ok && Boolean(emptyDashboard.payload.computed_at));
  const hasQuestionsBeforeIngest = (emptyDashboard.payload.questions?.length ?? 0) > 0;
  record(
    "empty states render with actionable guidance",
    Array.isArray(emptyDashboard.payload.empty_states) &&
      emptyDashboard.payload.empty_states.every(
        (item) => Boolean(item.id && item.message && item.next_action),
      ) &&
      (hasQuestionsBeforeIngest
        ? !emptyDashboard.payload.empty_states.some((item) => item.id === "no_questions")
        : emptyDashboard.payload.empty_states.some((item) => item.id === "no_questions")),
  );
  record(
    "mock/live mode indicators present",
    (emptyDashboard.payload.fetch_modes ?? []).some(
      (mode) => mode.source === "polymarket" && mode.mode === "mock",
    ) &&
      (emptyDashboard.payload.fetch_modes ?? []).some(
        (mode) => mode.source === "gdelt" && mode.mode === "mock",
      ),
  );
  record(
    "live fetch disabled warnings present",
    (emptyDashboard.payload.operator_warnings ?? []).some((warning) =>
      warning.toLowerCase().includes("live fetch disabled"),
    ),
  );

  await json("POST", "/api/forecast/question-sources/polymarket/ingest", { use_mock: true });
  await json("POST", "/api/forecast/evidence/gdelt/ingest", { use_mock: true, country: "UKR" });

  const dashboard1 = await json("GET", "/api/forecast/dashboard");
  record(
    "dashboard includes imported questions",
    (dashboard1.payload.questions?.length ?? 0) >= 1,
  );
  record(
    "question workflow steps present",
    (dashboard1.payload.question_workflows?.[0]?.steps?.length ?? 0) >= 12,
  );

  const sourceMarketId = dashboard1.payload.questions?.[0]?.source_market_id;
  const agent = await ensureAgent();
  record("agent available", Boolean(agent?.agent_id));

  let sessionId = null;
  if (sourceMarketId) {
    const session = await json("POST", "/api/forecast/question-sources/polymarket/sessions", {
      source_market_id: sourceMarketId,
      agent_id: agent.agent_id,
    });
    sessionId = session.payload.session_id;
    record("create session from dashboard question", session.ok && Boolean(sessionId), { sessionId });
  }

  if (!sessionId) {
    const failed = results.filter((item) => !item.ok);
    console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
    process.exit(1);
  }

  const lockBlocked = await json("POST", `/api/forecast/replay/sessions/${sessionId}/lock`);
  record(
    "lock without probability returns clear blocked reason",
    lockBlocked.status === 400 &&
      String(lockBlocked.payload.error ?? "").toLowerCase().includes("probability"),
    { error: lockBlocked.payload.error },
  );

  await json("POST", `/api/forecast/replay/sessions/${sessionId}/news-evidence`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-assessment`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/plan-source-requests`);
  const agentRun = await json("POST", `/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
    strategy_id: "aggressive_pattern_matcher",
    agent_id: agent.agent_id,
  });
  record("agent run from dashboard workflow", agentRun.ok, { status: agentRun.payload.status });

  const refresh = await json("POST", `/api/forecast/replay/sessions/${sessionId}/refresh-market`);
  record("refresh market from dashboard workflow", refresh.ok, {
    implied_probability: refresh.payload.refresh?.implied_probability,
  });

  const dashboard2 = await json("GET", "/api/forecast/dashboard");
  const workflow = (dashboard2.payload.question_workflows ?? []).find(
    (item) => item.source_market_id === sourceMarketId,
  );
  record(
    "guided workflow shows completed steps after actions",
    workflow?.steps?.some((step) => step.step_id === "create_session" && step.state === "completed") &&
      workflow?.steps?.some((step) => step.step_id === "assess_evidence" && step.state === "completed") &&
      workflow?.steps?.some(
        (step) => step.step_id === "run_aggressive_agent" && step.state === "completed",
      ),
    {
      steps: workflow?.steps?.map((step) => `${step.step_id}:${step.state}`),
    },
  );
  record(
    "lock step blocked until probability set",
    workflow?.steps?.some(
      (step) =>
        step.step_id === "lock_forecast" &&
        step.state === "blocked" &&
        String(step.blocked_reason ?? "").toLowerCase().includes("probability"),
    ),
  );

  const sessionRows = Object.values(dashboard2.payload.sessions_by_bucket ?? {}).flat();
  const updated = sessionRows.find((row) => row.session_id === sessionId);
  record(
    "dashboard reflects updated session state",
    Boolean(updated) && updated.evidence_score != null,
    {
      evidence_score: updated?.evidence_score,
      recommendation: updated?.recommendation,
      open_source_request_count: updated?.open_source_request_count,
    },
  );
  record(
    "dashboard reflects open source requests",
    (dashboard2.payload.open_source_requests?.length ?? 0) >= 1,
  );
  record(
    "dashboard reflects recent market refresh",
    (dashboard2.payload.recent_market_refreshes?.length ?? 0) >= 1,
  );

  runGitignoreAudit();

  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder"];
  const files = [
    "src/lib/forecasting/buildForecastDashboard.ts",
    "src/lib/forecasting/dashboardWorkflow.ts",
    "src/components/ForecastDashboardPageClient.tsx",
    "src/app/api/forecast/dashboard/route.ts",
  ];
  for (const relativePath of files) {
    const content = readFileSync(path.join(REPO, relativePath), "utf8");
    for (const pattern of forbidden) {
      record(`no forbidden pattern ${pattern} in ${relativePath}`, !new RegExp(pattern, "i").test(content));
    }
  }

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
