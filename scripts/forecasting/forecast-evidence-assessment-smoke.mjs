/**
 * Evidence assessment + source planning smoke test (mock Polymarket + GDELT).
 * Run: npm run forecast:evidence-assessment-smoke
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
    name: "Evidence Assessment Smoke Agent",
    type: "ai",
    description: "evidence assessment smoke",
  });
  return created.payload;
}

function runGitignoreAudit(sessionId) {
  const paths = [
    `data/forecasting/evidence_assessments/${sessionId}/assessment.v1.json`,
    "data/forecasting/evidence_sources/gdelt/news_events.v1.jsonl",
    "data/forecasting/question_sources/polymarket/questions.v1.jsonl",
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
  console.log("Evidence assessment smoke test (mock Polymarket + GDELT)");

  await json("POST", "/api/forecast/evidence/gdelt/ingest", { use_mock: true, country: "UKR" });
  await json("POST", "/api/forecast/question-sources/polymarket/ingest", { use_mock: true });

  const questions = await json("GET", "/api/forecast/question-sources/polymarket/questions");
  let sourceMarketId = questions.payload.questions?.[0]?.source_market_id;
  record("polymarket question available", Boolean(sourceMarketId));

  const agent = await ensureAgent();
  record("forecast agent available", Boolean(agent?.agent_id), { agent_id: agent?.agent_id });

  let sessionId = null;
  if (sourceMarketId) {
    const session = await json("POST", "/api/forecast/question-sources/polymarket/sessions", {
      source_market_id: sourceMarketId,
      agent_id: agent?.agent_id,
    });
    sessionId = session.payload.session_id;
    record("create Polymarket forecast session", session.ok && Boolean(sessionId), { sessionId });
  }

  const weakSession = await json("POST", "/api/forecast/replay/sessions", {
    template_id: "unodc_homicide_rate_direction",
    target: "USA",
    year: 2010,
    agent_id: agent?.agent_id,
  });
  const weakSessionId = weakSession.payload.session_id;
  record("create weak replay session for strategy checks", weakSession.ok && Boolean(weakSessionId), {
    weakSessionId,
  });

  if (!sessionId || !weakSessionId) {
    const failed = results.filter((item) => !item.ok);
    console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
    process.exit(1);
  }

  const cautious = await json("POST", `/api/forecast/replay/sessions/${weakSessionId}/agent-runs`, {
    strategy_id: "cautious_source_hound",
    agent_id: agent.agent_id,
  });
  record(
    "cautious agent requests more sources on weak evidence",
    cautious.ok && cautious.payload.status === "needs_sources",
    { status: cautious.payload.status, recommended_action: cautious.payload.recommended_action },
  );

  const aggressiveSession = await json("POST", "/api/forecast/replay/sessions", {
    template_id: "unodc_homicide_rate_direction",
    target: "USA",
    year: 2010,
    agent_id: agent?.agent_id,
  });
  const aggressiveSessionId = aggressiveSession.payload.session_id;
  await json("POST", `/api/forecast/replay/sessions/${aggressiveSessionId}/evidence-snapshot`);

  const aggressive = await json(
    "POST",
    `/api/forecast/replay/sessions/${aggressiveSessionId}/agent-runs`,
    {
      strategy_id: "aggressive_pattern_matcher",
      agent_id: agent.agent_id,
    },
  );
  record(
    "aggressive agent forecasts with weaker evidence",
    aggressive.ok && aggressive.payload.status === "completed",
    {
      status: aggressive.payload.status,
      confidence: aggressive.payload.confidence,
      recommended_action: aggressive.payload.recommended_action,
    },
  );
  record(
    "aggressive agent requires human review (no auto-lock)",
    aggressive.payload.status === "completed" &&
      aggressive.payload.recommended_action === "human_review",
    {
      recommended_action: aggressive.payload.recommended_action,
      uncertainty_notes: aggressive.payload.uncertainty_notes?.slice(0, 120),
    },
  );

  const attach = await json("POST", `/api/forecast/replay/sessions/${sessionId}/news-evidence`);
  record(
    "attach GDELT mock evidence",
    attach.ok && (attach.payload.attached_count ?? 0) >= 1,
    { attached_count: attach.payload.attached_count },
  );

  const snapshot = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/evidence-snapshot`,
  );
  record(
    "build evidence snapshot",
    snapshot.ok && Boolean(snapshot.payload.evidence_snapshot_id),
    { evidence_snapshot_id: snapshot.payload.evidence_snapshot_id },
  );

  const assess = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/evidence-assessment`,
  );
  const assessment = assess.payload.assessment;
  record(
    "assess session evidence",
    assess.ok &&
      assessment &&
      typeof assessment.scores?.overall_evidence_score === "number" &&
      ["forecast_now", "request_more_sources", "human_review"].includes(assessment.recommendation),
    {
      overall: assessment?.scores?.overall_evidence_score,
      recommendation: assessment?.recommendation,
      gap_count: assessment?.source_gaps?.length,
    },
  );

  const planA = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/plan-source-requests`,
  );
  const planB = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/plan-source-requests`,
  );
  record(
    "plan source requests creates requests",
    planA.ok && (planA.payload.created_count ?? 0) >= 1,
    {
      created: planA.payload.created_count,
      reused: planA.payload.reused_count,
    },
  );
  record(
    "plan source requests dedupes on re-run",
    planB.ok && (planB.payload.created_count ?? 0) === 0 && (planB.payload.reused_count ?? 0) >= 1,
    {
      created: planB.payload.created_count,
      reused: planB.payload.reused_count,
    },
  );

  runGitignoreAudit(sessionId);

  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder"];
  const files = [
    "src/lib/forecasting/evidence/assessSessionEvidence.ts",
    "src/lib/forecasting/evidence/planSourceRequestsFromAssessment.ts",
    "src/lib/forecasting/runForecastAgent.ts",
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
