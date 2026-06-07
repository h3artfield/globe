import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { IndicatorRegistryEntry, MetricValue } from "@/types/pipeline";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { ensureDirectory, readJsonFile, repoPath } from "@/lib/pipeline/io";
import { writeProcessedMetrics } from "@/lib/pipeline/metrics";
import { fetchWorldBankIndicator, latestWorldBankMetric } from "@/lib/pipeline/worldBank";

type IndicatorRegistryFile = {
  indicators: IndicatorRegistryEntry[];
};

type RawWorldBankRecord = {
  country_code: string;
  metric_id: string;
  indicator_code: string;
  source_url: string;
  observations: unknown[];
};

const retrievedAt = new Date().toISOString();
const rawRunId = retrievedAt.replace(/[:.]/g, "-");
const rawDirectory = repoPath("data", "raw", "world_bank", rawRunId);

async function main() {
  const registry = await readJsonFile<IndicatorRegistryFile>(
    repoPath("data", "sources", "indicator_registry.v1.json"),
  );
  const worldBankIndicators = registry.indicators.filter(
    (indicator) =>
      indicator.preferred_sources.includes("world_bank_wdi") && indicator.source_indicator_code,
  );
  const rawRecords: RawWorldBankRecord[] = [];

  await ensureDirectory(rawDirectory);

  for (const countryCode of MVP_COUNTRIES) {
    const results = await Promise.all(
      worldBankIndicators.map(async (indicator) => {
        const indicatorCode = indicator.source_indicator_code;

        if (!indicatorCode) {
          return null;
        }

        try {
          const { observations, sourceUrl } = await fetchWorldBankIndicator(
            countryCode,
            indicatorCode,
          );

          rawRecords.push({
            country_code: countryCode,
            metric_id: indicator.metric_id,
            indicator_code: indicatorCode,
            source_url: sourceUrl,
            observations,
          });

          const metric = latestWorldBankMetric(
            countryCode,
            indicator,
            observations,
            sourceUrl,
            retrievedAt,
          );

          if (metric.value !== null && metric.year !== null && metric.unit && metric.source_name) {
            return metric;
          }

          return null;
        } catch (error) {
          rawRecords.push({
            country_code: countryCode,
            metric_id: indicator.metric_id,
            indicator_code: indicatorCode,
            source_url: `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}`,
            observations: [
              {
                error: error instanceof Error ? error.message : "Unknown World Bank ingestion error",
              },
            ],
          });

          return null;
        }
      }),
    );
    const metrics: MetricValue[] = results.filter(
      (metric): metric is MetricValue => metric !== null,
    );

    await writeProcessedMetrics(
      countryCode,
      metrics,
      retrievedAt,
      registry.indicators
        .filter((indicator) => indicator.required)
        .map((indicator) => indicator.metric_id),
    );
  }

  await writeFile(
    path.join(rawDirectory, "world_bank_wdi.raw.json"),
    `${JSON.stringify(
      {
        source_id: "world_bank_wdi",
        retrieved_at: retrievedAt,
        records: rawRecords,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
