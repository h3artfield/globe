import assert from "node:assert/strict";
import test from "node:test";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { mergeMetrics } from "@/lib/metrics/mergeMetrics";
import { validateMetricProvenance } from "@/lib/provenance/provenanceValidator";
import { buildCountryCoverageReport } from "@/lib/pipeline/coverage";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { selectRelevantModules } from "@/lib/rag/selectRelevantModules";
import { POST as askPost } from "@/app/api/ask/route";
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
  assert.throws(() => assertIso3("United States"));
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
