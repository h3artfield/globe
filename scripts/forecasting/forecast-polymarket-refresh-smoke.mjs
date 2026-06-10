/**
 * Polymarket live market refresh + resolve-from-market smoke test (mock only).
 * Run: npm run forecast:polymarket-refresh-smoke
 * (Requires `npm run dev`; set FORECAST_SMOKE_BASE if not on :3000)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

process.env.POLYMARKET_USE_MOCK = "true";
process.env.POLYMARKET_ALLOW_LIVE_FETCH = "false";

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

function runGitignoreAudit() {
  const paths = [
    "data/forecasting/question_sources/polymarket/market_refreshes.v1.jsonl",
    "data/forecasting/question_sources/polymarket/questions.v1.jsonl",
    "data/raw/polymarket/test/events.v1.json",
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
  console.log("Polymarket refresh + resolve smoke test (mock only)");

  await json("POST", "/api/forecast/question-sources/polymarket/ingest", { use_mock: true });
  const questions = await json("GET", "/api/forecast/question-sources/polymarket/questions");
  const sourceMarketId = questions.payload.questions?.[0]?.source_market_id;
  record("polymarket question imported", Boolean(sourceMarketId), { sourceMarketId });

  const bulkRefresh = await json("POST", "/api/forecast/question-sources/polymarket/refresh", {
    use_mock: true,
  });
  record(
    "bulk refresh imported questions",
    bulkRefresh.ok && (bulkRefresh.payload.refreshed_count ?? 0) >= 1,
    { refreshed_count: bulkRefresh.payload.refreshed_count },
  );

  let sessionId = null;
  if (sourceMarketId) {
    const session = await json("POST", "/api/forecast/question-sources/polymarket/sessions", {
      source_market_id: sourceMarketId,
    });
    sessionId = session.payload.session_id;
    record("create live Polymarket session", session.ok && session.payload.forecast_mode === "live", {
      sessionId,
    });
  }

  if (!sessionId) {
    const failed = results.filter((item) => !item.ok);
    console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
    process.exit(1);
  }

  const refresh = await json("POST", `/api/forecast/replay/sessions/${sessionId}/refresh-market`);
  const impliedAfterRefresh = refresh.payload.question?.implied_probability;
  record(
    "refresh market updates probability/status",
    refresh.ok &&
      refresh.payload.refresh?.market_status === "open" &&
      impliedAfterRefresh != null &&
      impliedAfterRefresh >= 0.34,
    {
      implied_probability: impliedAfterRefresh,
      market_status: refresh.payload.refresh?.market_status,
      volume: refresh.payload.refresh?.volume,
    },
  );

  const earlyResolve = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/resolve-from-market`,
  );
  record(
    "resolve before lock is blocked",
    earlyResolve.status === 400 &&
      String(earlyResolve.payload.error ?? "").includes("locked forecast"),
    { status: earlyResolve.status, error: earlyResolve.payload.error },
  );

  await json("PATCH", `/api/forecast/replay/sessions/${sessionId}`, {
    probability: 38,
    confidence: "medium",
    forecast_rationale: "Polymarket refresh smoke forecast",
  });
  const lock = await json("POST", `/api/forecast/replay/sessions/${sessionId}/lock`);
  record("lock forecast before resolve-from-market", lock.ok && lock.payload.status === "locked", {
    status: lock.payload.status,
  });

  const unresolved = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/refresh-market`,
  );
  record(
    "open refresh after lock keeps market unresolved",
    unresolved.ok && unresolved.payload.question?.resolution_status === "open",
    { resolution_status: unresolved.payload.question?.resolution_status },
  );

  const notYet = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/resolve-from-market`,
  );
  record(
    "resolve-from-market on open market returns not resolved yet",
    notYet.ok && notYet.payload.resolved === false && notYet.payload.message === "not resolved yet",
    notYet.payload,
  );

  await json("POST", "/api/forecast/question-sources/polymarket/refresh", {
    use_mock: true,
    mock_state: "resolved",
    source_market_ids: [sourceMarketId],
  });

  const resolved = await json(
    "POST",
    `/api/forecast/replay/sessions/${sessionId}/resolve-from-market`,
  );
  record(
    "resolve from mock resolved market",
    resolved.ok && resolved.payload.resolved === true && resolved.payload.resolution?.outcome === "yes",
    {
      outcome: resolved.payload.resolution?.outcome,
      winning_outcome: resolved.payload.refresh?.winning_outcome,
    },
  );

  const score = await json("POST", `/api/forecast/replay/sessions/${sessionId}/score`);
  record("score works after resolve-from-market", score.ok && Boolean(score.payload.scorecard_id), {
    scorecard_id: score.payload.scorecard_id,
  });

  const judge = await json("POST", `/api/forecast/replay/sessions/${sessionId}/judge`);
  record("judge works after resolve-from-market", judge.ok && Boolean(judge.payload.judge_audit_id), {
    judge_audit_id: judge.payload.judge_audit_id,
  });

  const postmortem = await json("POST", `/api/forecast/replay/sessions/${sessionId}/postmortem`);
  record(
    "postmortem works after resolve-from-market",
    postmortem.ok && Boolean(postmortem.payload.postmortem_id),
    { postmortem_id: postmortem.payload.postmortem_id },
  );

  runGitignoreAudit();

  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder"];
  const files = [
    "src/lib/forecasting/polymarket/gammaClient.ts",
    "src/lib/forecasting/polymarket/refreshPolymarketMarket.ts",
    "src/lib/forecasting/polymarket/resolveFromPolymarketMarket.ts",
    "src/lib/forecasting/replay/sourceAdapters/polymarketMarketAdapter.ts",
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
