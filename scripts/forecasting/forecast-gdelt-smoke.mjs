/**
 * GDELT news evidence intake smoke test (mock fixture only, no live network).
 * Run: npm run forecast:gdelt-smoke
 * (Requires `npm run dev`; set FORECAST_SMOKE_BASE if not on :3000)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

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

function runGitignoreAudit() {
  const paths = [
    "data/raw/gdelt/test/news.v1.json",
    "data/forecasting/evidence_sources/gdelt/news_events.v1.jsonl",
    "data/db/news_evidence.sqlite",
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
  console.log("GDELT news evidence smoke test (mock only)");

  const ingest = await json("POST", "/api/forecast/evidence/gdelt/ingest", {
    use_mock: true,
    country: "UKR",
  });
  record(
    "mock ingest normalizes GDELT records",
    ingest.ok && (ingest.payload.imported_count ?? 0) >= 1,
    ingest.payload,
  );

  const query = await json("GET", "/api/forecast/evidence/gdelt?country=UKR&limit=10");
  record(
    "GDELT evidence API returns indexed records",
    query.ok && (query.payload.records?.length ?? 0) >= 1,
    { count: query.payload.records?.length },
  );

  const polyQuestions = await json("GET", "/api/forecast/question-sources/polymarket/questions");
  let sourceMarketId = polyQuestions.payload.questions?.[0]?.source_market_id;
  if (!sourceMarketId) {
    await json("POST", "/api/forecast/question-sources/polymarket/ingest", { use_mock: true });
    const refreshed = await json("GET", "/api/forecast/question-sources/polymarket/questions");
    sourceMarketId = refreshed.payload.questions?.[0]?.source_market_id;
  }

  record("polymarket question available for session bootstrap", Boolean(sourceMarketId));

  let sessionId = null;
  if (sourceMarketId) {
    const session = await json("POST", "/api/forecast/question-sources/polymarket/sessions", {
      source_market_id: sourceMarketId,
    });
    sessionId = session.payload.session_id;
    record("create Polymarket forecast session", session.ok && Boolean(sessionId), {
      session_id: sessionId,
    });
  }

  if (sessionId) {
    const attach = await json(
      "POST",
      `/api/forecast/replay/sessions/${sessionId}/news-evidence`,
    );
    record(
      "attach GDELT news evidence to session snapshot",
      attach.ok && (attach.payload.attached_count ?? 0) >= 1,
      {
        attached_count: attach.payload.attached_count,
        total_news_records: attach.payload.total_news_records,
      },
    );
    record(
      "snapshot includes news_evidence_records",
      (attach.payload.snapshot?.news_evidence_records?.length ?? 0) >= 1,
    );
    record(
      "snapshot includes gdelt included_records",
      (attach.payload.snapshot?.included_records ?? []).some(
        (record) => record.source_id === "gdelt_news_events",
      ),
    );
  }

  runGitignoreAudit();

  const forbidden = ["privateKey", "wallet", "signTypedData", "placeOrder"];
  const files = [
    "src/lib/forecasting/gdelt/gdeltNewsClient.ts",
    "src/lib/forecasting/gdelt/ingestGdeltNews.ts",
    "src/lib/forecasting/gdelt/attachNewsEvidenceToSession.ts",
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
