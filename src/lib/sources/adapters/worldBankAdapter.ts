import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { IndicatorRegistryEntry, MetricValue } from "@/types/pipeline";
import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { ensureDirectory, readJsonFile, repoPath } from "@/lib/pipeline/io";
import { writeProcessedMetrics } from "@/lib/pipeline/metrics";
import { fetchWorldBankIndicator, latestWorldBankMetric } from "@/lib/pipeline/worldBank";
import { validateMetricProvenance } from "@/lib/provenance/provenanceValidator";
import type { SourceAdapter } from "../SourceAdapter";

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

type RawWorldBankFile = {
  source_id: "world_bank_wdi";
  retrieved_at: string;
  records: RawWorldBankRecord[];
};

export class WorldBankAdapter implements SourceAdapter {
  sourceId = "world_bank_wdi";

  private retrievedAt = new Date().toISOString();
  private rawDate = this.retrievedAt.slice(0, 10);
  private rawFilePath = `/data/raw/world_bank/${this.rawDate}/world_bank_wdi.raw.json`;
  private rawFilesystemPath = repoPath(
    "data",
    "raw",
    "world_bank",
    this.rawDate,
    "world_bank_wdi.raw.json",
  );

  async fetchRaw(): Promise<void> {
    const registry = await this.loadIndicatorRegistry();
    const worldBankIndicators = registry.indicators.filter(
      (indicator) =>
        indicator.preferred_sources.includes(this.sourceId) && indicator.source_indicator_code,
    );
    const rawRecords: RawWorldBankRecord[] = [];

    await ensureDirectory(path.dirname(this.rawFilesystemPath));

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

            return {
              country_code: countryCode,
              metric_id: indicator.metric_id,
              indicator_code: indicatorCode,
              source_url: sourceUrl,
              observations,
            } satisfies RawWorldBankRecord;
          } catch (error) {
            return {
              country_code: countryCode,
              metric_id: indicator.metric_id,
              indicator_code: indicatorCode,
              source_url: `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}`,
              observations: [
                {
                  error: error instanceof Error ? error.message : "Unknown World Bank ingestion error",
                },
              ],
            } satisfies RawWorldBankRecord;
          }
        }),
      );

      rawRecords.push(...results.filter((record): record is RawWorldBankRecord => record !== null));
    }

    await writeFile(
      this.rawFilesystemPath,
      `${JSON.stringify(
        {
          source_id: this.sourceId,
          retrieved_at: this.retrievedAt,
          records: rawRecords,
        } satisfies RawWorldBankFile,
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  async normalize(): Promise<void> {
    const registry = await this.loadIndicatorRegistry();
    const rawFile = await readJsonFile<RawWorldBankFile>(this.rawFilesystemPath);
    const indicatorById = new Map(registry.indicators.map((indicator) => [indicator.metric_id, indicator]));
    const metricsByCountry = new Map<string, MetricValue[]>();

    for (const rawRecord of rawFile.records) {
      const indicator = indicatorById.get(rawRecord.metric_id);

      if (!indicator) {
        continue;
      }

      const metric = latestWorldBankMetric(
        rawRecord.country_code,
        indicator,
        rawRecord.observations as Parameters<typeof latestWorldBankMetric>[2],
        rawRecord.source_url,
        rawFile.retrieved_at,
        this.rawFilePath,
      );

      if (metric.value !== null && metric.year !== null && metric.unit && metric.source_id) {
        metricsByCountry.set(rawRecord.country_code, [
          ...(metricsByCountry.get(rawRecord.country_code) ?? []),
          metric,
        ]);
      }
    }

    const requiredMetricIds = registry.indicators
      .filter((indicator) => indicator.required)
      .map((indicator) => indicator.metric_id);

    for (const countryCode of MVP_COUNTRIES) {
      await writeProcessedMetrics(
        countryCode,
        metricsByCountry.get(countryCode) ?? [],
        rawFile.retrieved_at,
        requiredMetricIds,
      );
    }
  }

  async validate(): Promise<void> {
    const registry = await this.loadIndicatorRegistry();
    const requiredMetricIds = registry.indicators
      .filter((indicator) => indicator.preferred_sources.includes(this.sourceId))
      .map((indicator) => indicator.metric_id);
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const countryCode of MVP_COUNTRIES) {
      const metricsFile = await readJsonFile<{ metrics: MetricValue[] }>(
        repoPath("data", "processed", "countries", countryCode, "metrics.v1.json"),
      );
      const sourceMetrics = metricsFile.metrics.filter(
        (metric) => metric.source_id === this.sourceId && requiredMetricIds.includes(metric.metric_id),
      );

      for (const metric of sourceMetrics) {
        const result = validateMetricProvenance(metric, `${countryCode}:${metric.metric_id}`);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }
  }

  private loadIndicatorRegistry(): Promise<IndicatorRegistryFile> {
    return readJsonFile<IndicatorRegistryFile>(
      repoPath("data", "sources", "indicator_registry.v1.json"),
    );
  }
}
