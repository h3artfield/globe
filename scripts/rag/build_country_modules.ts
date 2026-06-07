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

    for (const module of modules) {
      const payload =
        module.module === "national_cohesion_by_demographic"
          ? createNationalCohesionPayload(module)
          : module.module === "population_divisions"
            ? createPopulationDivisionsPayload(module)
            : module.module === "leader_dossiers"
              ? createLeaderDossiersPayload(module)
              : module.module === "scorecard"
                ? createScorecardPayload(module, processedMetrics.metrics)
                : module;

      await writeJsonFile(`${countryDirectory}/${module.module}.v1.json`, payload);
    }

    await writeJsonFile(`${countryDirectory}/sources.json`, {
      country_code: countryCode,
      generated_at: generatedAt,
      source_ids: Array.from(new Set(processedMetrics.metrics.map((metric) => metric.source_name))).filter(Boolean),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
