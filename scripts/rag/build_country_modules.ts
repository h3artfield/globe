import type { IndicatorRegistryEntry } from "@/types/pipeline";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { createAllCountryModules } from "@/lib/pipeline/countryModules";
import { readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import type { ProcessedMetricsFile } from "@/lib/pipeline/metrics";
import {
  createLeaderDossiersPayload,
  createNationalCohesionPayload,
  createPopulationDivisionsPayload,
  createScorecardPayload,
} from "@/lib/pipeline/specialModules";
import { writeCountryReviewQueue } from "@/lib/pipeline/reviewQueue";

type IndicatorRegistryFile = {
  indicators: IndicatorRegistryEntry[];
};

async function loadMetrics(countryCode: string): Promise<ProcessedMetricsFile> {
  try {
    return await readJsonFile<ProcessedMetricsFile>(
      repoPath("data", "processed", "countries", countryCode, "metrics.v1.json"),
    );
  } catch {
    return {
      country_code: countryCode,
      version: "1.0",
      generated_at: new Date().toISOString(),
      metrics: [],
    };
  }
}

async function main() {
  await readJsonFile<IndicatorRegistryFile>(repoPath("data", "sources", "indicator_registry.v1.json"));
  const generatedAt = new Date().toISOString();

  for (const countryCode of MVP_COUNTRIES) {
    const processedMetrics = await loadMetrics(countryCode);
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

    await writeJsonFile(`${countryDirectory}/sources.json`, {
      country_code: countryCode,
      generated_at: generatedAt,
      source_ids: Array.from(new Set(processedMetrics.metrics.map((metric) => metric.source_id))).filter(Boolean),
    });

    await writeCountryReviewQueue(countryCode, modules);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
