import type { CountryModule, IndicatorRegistryEntry } from "@/types/pipeline";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { COUNTRY_MODULES, MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { createAllCountryModules } from "@/lib/pipeline/countryModules";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { buildCountryCoverageReport } from "@/lib/pipeline/coverage";
import { pathExists, readJsonFile, repoPath, writeJsonFile, writeJsonLinesFile } from "@/lib/pipeline/io";
import type { ProcessedMetricsFile } from "@/lib/pipeline/metrics";
import { writeCountryReviewQueue } from "@/lib/pipeline/reviewQueue";
import {
  createLeaderDossiersPayload,
  createNationalCohesionPayload,
  createPopulationDivisionsPayload,
  createScorecardPayload,
} from "@/lib/pipeline/specialModules";
import { validateCountryModule, validateRagChunk } from "@/lib/pipeline/validation";

type IndicatorRegistryFile = {
  indicators: IndicatorRegistryEntry[];
};

async function loadProcessedMetrics(countryCode: string): Promise<ProcessedMetricsFile> {
  const metricsPath = repoPath("data", "processed", "countries", countryCode, "metrics.v1.json");

  if (!(await pathExists(metricsPath))) {
    return {
      country_code: countryCode,
      version: "1.0",
      generated_at: new Date().toISOString(),
      metrics: [],
    };
  }

  return readJsonFile<ProcessedMetricsFile>(metricsPath);
}

export async function buildCountry(countryCodeInput: string): Promise<void> {
  const countryCode = assertIso3(countryCodeInput);
  const registry = await readJsonFile<IndicatorRegistryFile>(
    repoPath("data", "sources", "indicator_registry.v1.json"),
  );
  const processedMetrics = await loadProcessedMetrics(countryCode);
  const generatedAt = new Date().toISOString();
  const modules = createAllCountryModules(countryCode, processedMetrics.metrics, generatedAt);
  const countryDirectory = repoPath("data", "rag", "countries", countryCode);

  for (const countryModule of modules) {
    const payload =
      countryModule.module === "national_cohesion_by_demographic"
        ? createNationalCohesionPayload(countryModule)
        : countryModule.module === "population_divisions"
          ? createPopulationDivisionsPayload(countryModule)
          : countryModule.module === "leader_dossiers"
            ? createLeaderDossiersPayload(countryModule)
            : countryModule.module === "scorecard"
              ? createScorecardPayload(countryModule, processedMetrics.metrics)
              : countryModule;

    await writeJsonFile(`${countryDirectory}/${countryModule.module}.v1.json`, payload);
  }

  const reviewQueueItems = await writeCountryReviewQueue(countryCode, modules);
  const chunks = modules.map((countryModule, index) => buildCountryChunk(countryModule, index + 1));

  await writeJsonLinesFile(`${countryDirectory}/chunks.jsonl`, chunks);
  await writeJsonFile(`${countryDirectory}/coverage_report.v1.json`, buildCountryCoverageReport(
    countryCode,
    modules,
    registry.indicators,
    reviewQueueItems,
  ));
  await writeJsonFile(`${countryDirectory}/sources.json`, {
    country_code: countryCode,
    generated_at: generatedAt,
    source_ids: Array.from(new Set(processedMetrics.metrics.map((metric) => metric.source_id))).filter(Boolean),
  });

  const errors = [
    ...modules.flatMap((countryModule) =>
      validateCountryModule(countryModule, `${countryCode}/${countryModule.module}.v1.json`).errors,
    ),
    ...chunks.flatMap((chunk, index) =>
      validateRagChunk(chunk, `${countryCode}/chunks.jsonl:${index + 1}`).errors,
    ),
  ];

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

async function main() {
  const countryArg = process.argv[2];
  const countries = countryArg === "--mvp" ? [...MVP_COUNTRIES] : [countryArg];

  if (!countries[0]) {
    throw new Error("Usage: npm run country:build -- USA");
  }

  for (const countryCode of countries) {
    await buildCountry(countryCode);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
