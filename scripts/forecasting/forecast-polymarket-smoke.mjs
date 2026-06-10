/**
 * Polymarket question intake smoke test (mock fixture only, no live network).
 * Run: npm run forecast:polymarket-smoke
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

function assertNoTradingCode() {
  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder", "CLOB.*auth"];
  const files = [
    "src/lib/forecasting/polymarket/gammaClient.ts",
    "src/lib/forecasting/polymarket/ingestPolymarketQuestions.ts",
    "src/lib/forecasting/polymarket/createForecastSessionFromPolymarketQuestion.ts",
  ];
  for (const relativePath of files) {
    const content = readFileSync(path.join(REPO, relativePath), "utf8");
    for (const pattern of forbidden) {
      record(`no forbidden pattern ${pattern} in ${relativePath}`, !new RegExp(pattern, "i").test(content));
    }
  }
}

function runGitignoreAudit() {
  const paths = [
    "data/raw/polymarket/test/events.v1.json",
    "data/forecasting/question_sources/polymarket/questions.v1.jsonl",
    "data/db/forecast_questions.sqlite",
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
  console.log("Polymarket intake smoke test (mock only)");

  const categories = await json("GET", "/api/forecast/question-sources/polymarket/categories");
  record(
    "load categories config",
    categories.ok && (categories.payload.categories?.length ?? 0) >= 5,
    { count: categories.payload.categories?.length },
  );

  const ingest = await json("POST", "/api/forecast/question-sources/polymarket/ingest", {
    use_mock: true,
  });
  record(
    "mock ingest normalizes questions",
    ingest.ok && (ingest.payload.imported_count ?? 0) >= 1,
    ingest.payload,
  );

  const questions = await json("GET", "/api/forecast/question-sources/polymarket/questions?sort=volume");
  record(
    "questions API returns indexed records",
    questions.ok && (questions.payload.questions?.length ?? 0) >= 1,
    { count: questions.payload.questions?.length },
  );

  const firstId = questions.payload.questions?.[0]?.source_market_id;
  record("question has source_market_id", Boolean(firstId));

  if (firstId) {
    const session = await json("POST", "/api/forecast/question-sources/polymarket/sessions", {
      source_market_id: firstId,
    });
    record(
      "create Forecast Lab session from Polymarket question",
      session.ok && session.payload.forecast_mode === "live",
      {
        session_id: session.payload.session_id,
        external_source: session.payload.external_source,
        source_question_id: session.payload.source_question_id,
      },
    );
    record(
      "session links back to Polymarket source",
      session.payload.external_source === "polymarket" &&
        session.payload.source_market_id === firstId,
    );
  }

  assertNoTradingCode();
  runGitignoreAudit();

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
