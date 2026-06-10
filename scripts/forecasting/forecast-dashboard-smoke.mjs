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

  await json("POST", "/api/forecast/question-sources/polymarket/ingest", { use_mock: true });
  await json("POST", "/api/forecast/evidence/gdelt/ingest", { use_mock: true, country: "UKR" });

  const dashboard1 = await json("GET", "/api/forecast/dashboard");
  record(
    "dashboard summary loads",
    dashboard1.ok && dashboard1.payload.computed_at,
    { question_count: dashboard1.payload.questions?.length },
  );
  record(
    "dashboard includes imported questions",
    (dashboard1.payload.questions?.length ?? 0) >= 1,
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

  await json("POST", `/api/forecast/replay/sessions/${sessionId}/news-evidence`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/evidence-assessment`);
  await json("POST", `/api/forecast/replay/sessions/${sessionId}/plan-source-requests`);
  const agentRun = await json("POST", `/api/forecast/replay/sessions/${sessionId}/agent-runs`, {
    strategy_id: "cautious_source_hound",
    agent_id: agent.agent_id,
  });
  record("agent run from dashboard workflow", agentRun.ok, { status: agentRun.payload.status });

  const refresh = await json("POST", `/api/forecast/replay/sessions/${sessionId}/refresh-market`);
  record("refresh market from dashboard workflow", refresh.ok, {
    implied_probability: refresh.payload.refresh?.implied_probability,
  });

  const dashboard2 = await json("GET", "/api/forecast/dashboard");
  const sessionRows = Object.values(dashboard2.payload.sessions_by_bucket ?? {}).flat();
  const updated = sessionRows.find((row) => row.session_id === sessionId);
  record(
    "dashboard reflects updated session state",
    Boolean(updated) &&
      (updated.open_source_request_count > 0 ||
        updated.latest_agent_run_status === "needs_sources" ||
        updated.evidence_score != null),
    {
      evidence_score: updated?.evidence_score,
      recommendation: updated?.recommendation,
      latest_agent_run_status: updated?.latest_agent_run_status,
      open_source_request_count: updated?.open_source_request_count,
    },
  );
  record(
    "dashboard reflects open source requests",
    (dashboard2.payload.open_source_requests?.length ?? 0) >= 1,
    { open_count: dashboard2.payload.open_source_requests?.length },
  );
  record(
    "dashboard reflects recent market refresh",
    (dashboard2.payload.recent_market_refreshes?.length ?? 0) >= 1,
  );

  runGitignoreAudit();

  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder"];
  const files = [
    "src/lib/forecasting/buildForecastDashboard.ts",
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
