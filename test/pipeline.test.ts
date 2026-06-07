import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { mergeMetrics } from "@/lib/metrics/mergeMetrics";
import { calculateWorldShare } from "@/lib/metrics/calculateWorldShare";
import { validateMetricProvenance } from "@/lib/provenance/provenanceValidator";
import { buildCountryCoverageReport } from "@/lib/pipeline/coverage";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { getMetricModule } from "@/lib/pipeline/countryModules";
import { selectRelevantModules } from "@/lib/rag/selectRelevantModules";
import { scoreEventImportance } from "@/lib/worldModel/eventImportance";
import { buildEmptyRelationshipGraph } from "@/lib/worldModel/defaults";
import { MockEmbeddingProvider } from "@/lib/vector/embeddingProvider";
import { embedChunks, inferAuthorityRank } from "@/lib/vector/chunkEmbedder";
import { writeEmbeddedChunks, readEmbeddedChunks } from "@/lib/vector/vectorStore";
import { hybridSearch } from "@/lib/vector/hybridSearch";
import { citationsFromChunks } from "@/lib/vector/citationBuilder";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { POST as askPost } from "@/app/api/ask/route";
import { findManualImportFiles, archiveManualImportFiles } from "@/lib/sources/manualImport";
import { buildSourceFamilyCoverage } from "@/lib/sources/sourceCoverage";
import { generateNarrativeDraftForModule } from "@/lib/dossier/narrativeDraftGenerator";
import { appendApprovedClaimToModule, createSourceRequest, listReviewItems, preserveRejectedClaim, rebuildCountryChunks } from "@/lib/review/reviewWorkflow";
import { validateDossierModule } from "@/lib/dossier/moduleDraftValidator";
import { createCountrySourcePack } from "@/lib/pilot/sourcePack";
import { buildCountrySourceGapReport, sourceRequestsFromGaps } from "@/lib/pilot/sourceGaps";
import { buildPilotReadiness } from "@/lib/pilot/readiness";
import { saveAnswerAudit } from "@/lib/pilot/answerAudit";
import type { CountryModule, IndicatorRegistryEntry, MetricValue } from "@/types/pipeline";

function metric(overrides: Partial<MetricValue> = {}): MetricValue {
  return {
    metric_id: "gdp_current_usd",
    country_code: "USA",
    value: 100,
    unit: "current_usd",
    year: 2024,
    source_id: "world_bank_wdi",
    source_name: "World Bank WDI",
    source_url: "https://example.com",
    retrieved_at: "2026-06-07T00:00:00.000Z",
    raw_file_path: "/data/raw/world_bank/2026-06-07/world_bank_wdi.raw.json",
    raw_record_id: "USA:gdp_current_usd",
    calculation: "NY.GDP.MKTP.CD",
    confidence: "medium",
    freshness_requirement: "latest_available_year",
    freshness_status: "fresh",
    notes: "",
    ...overrides,
  };
}

function countryModule(overrides: Partial<CountryModule> = {}): CountryModule {
  return {
    country_code: "USA",
    module: "economy",
    version: "1.0",
    last_updated: "2026-06-07",
    summary: "",
    key_findings: [],
    metrics: [metric()],
    claims: [],
    open_questions: [],
    source_ids: ["world_bank_wdi"],
    confidence: { overall: "medium", weak_areas: [] },
    ...overrides,
  };
}

test("relationship IDs are alphabetically sorted", () => {
  assert.equal(buildRelationshipId("USA", "CHN"), "CHN_USA");
});

test("country ISO3 validation rejects invalid codes", () => {
  assert.equal(assertIso3("usa"), "USA");
  assert.equal(assertIso3("United States"), "USA");
  assert.throws(() => assertIso3("Atlantis"));
});

test("metric merge replaces by country, metric, year, and source", () => {
  const oldMetric = metric({ value: 100 });
  const newMetric = metric({ value: 200 });
  const merged = mergeMetrics([oldMetric], [newMetric]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].value, 200);
});

test("provenance validation warns on missing raw file path", () => {
  const result = validateMetricProvenance(metric({ raw_file_path: null }));
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("missing raw_file_path")));
});

test("coverage report includes structured and provenance scores", () => {
  const indicators: IndicatorRegistryEntry[] = [
    {
      metric_id: "gdp_current_usd",
      label: "GDP",
      module: "economy",
      preferred_sources: ["world_bank_wdi"],
      unit: "current_usd",
      freshness_requirement: "latest_available_year",
      formula: "NY.GDP.MKTP.CD",
      required: true,
    },
  ];
  const report = buildCountryCoverageReport("USA", [countryModule()], indicators, []);
  assert.equal(report.structured_data_score, 100);
  assert.equal(report.provenance_score, 100);
});

test("chunk generation includes module and metric IDs", () => {
  const chunk = buildCountryChunk(countryModule(), 1);
  assert.equal(chunk.module, "economy");
  assert.deepEqual(chunk.metric_ids, ["gdp_current_usd"]);
});

test("question module selection maps trade questions", () => {
  const selection = selectRelevantModules("How would tariffs affect exports and shipping?");
  assert.ok(selection.countryModules.includes("trade_exports_imports"));
  assert.ok(selection.relationshipModules.includes("trade_relationship"));
});

test("question module selection maps allies, enemies, and events questions", () => {
  assert.ok(selectRelevantModules("Who are its closest allies?").countryModules.includes("allies_and_partners"));
  assert.ok(selectRelevantModules("Who are its enemies and threat perceptions?").countryModules.includes("adversaries_and_rivals"));
  assert.ok(selectRelevantModules("What were the top events in the past 20 years?").countryModules.includes("top_national_events_20_years"));
});

test("event importance prioritizes institutional conflict over raw media volume", () => {
  const coupScore = scoreEventImportance({ leadershipChange: true, constitutionalChange: true, warInvolvement: true });
  const mediaOnlyScore = scoreEventImportance({ gdeltVolume: 1000000, majorSourceFrequency: 1000 });
  assert.ok(coupScore > mediaOnlyScore);
});

test("world relationship graph contains MVP relationship edges", () => {
  const graph = buildEmptyRelationshipGraph();
  assert.ok(graph.nodes.some((node) => node.country_code === "USA"));
  assert.ok(graph.edges.some((edge) => edge.relationship_id === "CHN_USA"));
});

test("manual file import detection finds CSV files", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "manual-import-"));
  const importDir = path.join(tempRoot, "imports");
  await mkdir(importDir, { recursive: true });
  await writeFile(path.join(tempRoot, "ignore.txt"), "nope");
  await writeFile(path.join(importDir, "metrics.csv"), "country_code,year,metric_id,value\nUSA,2024,exports_total_usd,1\n");

  const files = await findManualImportFiles({
    source_id: "un_comtrade",
    mode: "manual_file",
    api_base_url: "",
    manual_import_dir: importDir,
    raw_output_dir: path.join(tempRoot, "raw"),
    requires_api_key: false,
    env_key_name: "",
    notes: "",
  });

  assert.equal(files.length, 1);
  await rm(tempRoot, { recursive: true, force: true });
});

test("raw file archival copies manual files", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "manual-archive-"));
  const importDir = path.join(tempRoot, "imports");
  await mkdir(importDir, { recursive: true });
  const sourceFile = path.join(importDir, "metrics.csv");
  await writeFile(sourceFile, "country_code,year,metric_id,value\nUSA,2024,exports_total_usd,1\n");

  const archived = await archiveManualImportFiles(
    {
      source_id: "un_comtrade",
      mode: "manual_file",
      api_base_url: "",
      manual_import_dir: importDir,
      raw_output_dir: path.join(tempRoot, "raw"),
      requires_api_key: false,
      env_key_name: "",
      notes: "",
    },
    [sourceFile],
    "2026-06-07",
  );

  assert.equal(archived.archivedFiles.length, 1);
  assert.ok(archived.archivedFiles[0].endsWith("metrics.csv"));
  await rm(tempRoot, { recursive: true, force: true });
});

test("derived world-share calculation includes formula and source", () => {
  const share = calculateWorldShare(
    metric({ metric_id: "exports_total_usd", value: 10, source_id: "un_comtrade" }),
    metric({ metric_id: "exports_total_usd", country_code: "WLD", value: 100, source_id: "un_comtrade" }),
    "exports_world_share_percent",
  );

  assert.equal(share?.value, 10);
  assert.equal(share?.source_id, "derived_from_un_comtrade");
  assert.ok(share?.calculation?.includes("world_total"));
});

test("source coverage reporting marks partial source coverage", () => {
  const coverage = buildSourceFamilyCoverage("un_comtrade", [
    metric({ metric_id: "exports_total_usd", source_id: "un_comtrade" }),
  ]);
  assert.equal(coverage.status, "partial");
  assert.ok(coverage.metrics_missing.includes("imports_total_usd"));
});

test("demographic sample-size warning is detected by provenance validator input", () => {
  const surveyMetric = metric({
    metric_id: "national_pride_score",
    source_id: "world_values_survey",
    sample_size: 50,
  });
  const result = validateMetricProvenance(surveyMetric);
  assert.ok(result.warnings.some((warning) => warning.includes("sample size is too small")));
});

test("module generation maps source metrics to source-specific modules", () => {
  assert.equal(getMetricModule("exports_total_usd"), "trade_exports_imports");
  assert.equal(getMetricModule("electoral_democracy_index"), "government_current");
  assert.equal(getMetricModule("patent_applications_resident"), "technology_contributions");
});

test("mock embedding provider generates stable dimensions", async () => {
  const provider = new MockEmbeddingProvider();
  const vector = await provider.embedText("trade exports imports");
  assert.equal(vector.length, 64);
});

test("chunk embedding persistence round trips", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "embeddings-"));
  const provider = new MockEmbeddingProvider();
  const chunk = buildCountryChunk(countryModule(), 1);
  const embedded = await embedChunks([chunk], provider);
  const filePath = path.join(tempRoot, "chunks.embeddings.jsonl");
  await writeEmbeddedChunks(filePath, embedded);
  const loaded = await readEmbeddedChunks(filePath);
  assert.equal(loaded[0].chunk_id, chunk.chunk_id);
  await rm(tempRoot, { recursive: true, force: true });
});

test("hybrid retrieval scores relevant trade chunks", async () => {
  const provider = new MockEmbeddingProvider();
  const tradeChunk = buildCountryChunk(countryModule({ module: "trade_exports_imports" }), 1);
  const historyChunk = buildCountryChunk(countryModule({ module: "history", metrics: [] }), 2);
  const embedded = await embedChunks([tradeChunk, historyChunk], provider);
  const results = await hybridSearch({
    question: "exports and imports",
    chunks: [tradeChunk, historyChunk],
    embeddedChunks: embedded,
    selectedModules: ["trade_exports_imports"],
    selectedCountries: ["USA"],
    selectedRelationships: [],
    provider,
  });
  assert.equal(results[0].chunk.module, "trade_exports_imports");
});

test("source authority downgrades Wikipedia chunks", () => {
  const wikiChunk = buildCountryChunk(countryModule({ module: "wikipedia_baseline", source_ids: ["wikipedia"] }), 1);
  assert.equal(inferAuthorityRank(wikiChunk), "wikipedia");
});

test("citation builder emits chunk citations", () => {
  const chunk = buildCountryChunk(countryModule(), 1);
  const citations = citationsFromChunks([chunk]);
  assert.equal(citations[0].chunk_id, chunk.chunk_id);
});

test("retrieval eval file has expected modules", async () => {
  const evalFile = await readJsonFile<{ items: Array<{ expected_modules: string[] }> }>(
    repoPath("data", "eval", "retrieval_eval.v1.json"),
  );
  assert.ok(evalFile.items.every((item) => item.expected_modules.length > 0));
});

test("/api/ask reports missing data from coverage", async () => {
  const response = await askPost(
    new Request("http://localhost/api/ask", {
      method: "POST",
      body: JSON.stringify({
        question: "What happens if Egypt and Ethiopia escalate over Nile water rights?",
        selectedCountries: ["EGY", "ETH"],
        mode: "strategic",
      }),
    }),
  );
  const payload = (await response.json()) as { missing_data?: string[]; modules_used?: string[] };
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.missing_data));
  assert.ok(payload.missing_data.length > 0);
  assert.ok(payload.modules_used?.some((moduleName) => moduleName.includes("military")));
});

test("/api/ask returns citations and retrieval debug", async () => {
  const response = await askPost(
    new Request("http://localhost/api/ask", {
      method: "POST",
      body: JSON.stringify({
        question: "Who are Egypt's main adversaries?",
        selectedCountries: ["EGY"],
        mode: "strategic",
        debug: true,
      }),
    }),
  );
  const payload = (await response.json()) as { citations?: unknown[]; retrieval_debug?: unknown };
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.citations));
  assert.ok(payload.retrieval_debug);
});

test("review item listing returns pending items", async () => {
  const items = await listReviewItems();
  assert.ok(items.length > 0);
});

test("draft generation from module creates review-status claims or source request", async () => {
  const draft = await generateNarrativeDraftForModule("USA", "leader_dossiers");
  assert.ok(draft.prompt_hash);
  assert.ok(["llm_drafted_unreviewed", "needs_better_sources"].includes(draft.review_status));
  assert.ok(draft.claims.every((claim) => claim.review_status));
});

test("claim approval copies approved claim into module and rebuilds chunks", async () => {
  const claim = {
    claim_id: `USA-history-test-${Date.now()}`,
    text: "Test sourced claim.",
    claim_type: "fact" as const,
    source_ids: ["world_bank_wdi"],
    confidence: "medium" as const,
    review_status: "human_reviewed" as const,
    last_verified: "2026-06-07",
    notes: "metric_id=gdp_current_usd",
  };
  await appendApprovedClaimToModule("USA", "history", claim);
  await rebuildCountryChunks("USA");
  const countryModuleValue = await readJsonFile<CountryModule>(repoPath("data", "rag", "countries", "USA", "history.v1.json"));
  assert.ok(countryModuleValue.claims.some((item) => item.claim_id === claim.claim_id));
});

test("claim rejection is preserved with reason", async () => {
  const claim = {
    claim_id: `USA-history-reject-${Date.now()}`,
    text: "Rejected claim.",
    claim_type: "fact" as const,
    source_ids: ["world_bank_wdi"],
    confidence: "low" as const,
    review_status: "rejected" as const,
    last_verified: "",
    notes: "",
  };
  await preserveRejectedClaim(claim, "test rejection");
  const rejected = await readJsonFile<{ claim: { claim_id: string } }>(repoPath("data", "rejected_claims", `${claim.claim_id}.json`));
  assert.equal(rejected.claim.claim_id, claim.claim_id);
});

test("needs-better-sources flow creates source request", async () => {
  const request = await createSourceRequest("USA", "leader_dossiers", ["Who is in power?"]);
  assert.equal(request.status, "open");
  const stored = await readJsonFile<{ request_id: string }>(repoPath("data", "source_requests", "countries", "USA", "leader_dossiers.json"));
  assert.equal(stored.request_id, request.request_id);
});

test("dossier validator accepts verified sourced claim", () => {
  const countryModuleValue = countryModule({
    claims: [{
      claim_id: "USA-test-verified-001",
      text: "Verified sourced claim.",
      claim_type: "fact",
      source_ids: ["world_bank_wdi"],
      confidence: "high",
      review_status: "verified",
      last_verified: "2026-06-07",
      notes: "metric_id=gdp_current_usd",
    }],
  });
  const result = validateDossierModule(countryModuleValue);
  assert.equal(result.errors.length, 0);
});

test("source gap report produces module readiness", async () => {
  await createCountrySourcePack("USA");
  const report = await buildCountrySourceGapReport("USA");
  assert.equal(report.target_id, "USA");
  assert.ok(report.modules.some((module) => module.module === "leader_dossiers"));
});

test("source request generator creates actionable requests", async () => {
  const report = await buildCountrySourceGapReport("USA");
  const requests = sourceRequestsFromGaps(report);
  assert.ok(requests.length > 0);
  assert.ok(requests[0].suggested_search_queries.length > 0);
});

test("pilot readiness reports failed gates when sources are missing", async () => {
  const report = await buildPilotReadiness("USA", "country");
  assert.equal(report.target_id, "USA");
  assert.ok(Array.isArray(report.failed_gates));
});

test("answer audit can be saved", async () => {
  const audit = await saveAnswerAudit({
    question: "Test audit?",
    selectedCountries: ["USA"],
    response: {
      answer: "Test",
      selectedCountries: ["USA"],
      strategicSummary: {
        mainIncentives: [],
        mainConstraints: [],
        likelyMoves: [],
        escalationRisks: [],
        deescalationOptions: [],
      },
      confidence: "low",
      missingData: [],
      sourceIds: [],
    },
  });
  assert.ok(audit.audit_id.startsWith("audit_"));
});
