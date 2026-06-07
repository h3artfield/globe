import path from "node:path";
import type { MetricValue, SourceConfig } from "@/types/pipeline";
import { buildMetricWithProvenance } from "@/lib/provenance/provenanceBuilder";
import { buildRawRecordId } from "@/lib/provenance/sourceRecord";
import { calculateFreshnessStatus } from "@/lib/metrics/calculateFreshness";
import { calculateWorldShare } from "@/lib/metrics/calculateWorldShare";
import { getSourceMetricDefinition, getSourceMetricDefinitions } from "@/lib/sources/sourceMetricDefinitions";
import { mapToIso3 } from "@/lib/sources/countryCodeMapper";
import { archiveManualImportFiles, findManualImportFiles, toPublicDataPath } from "@/lib/sources/manualImport";
import { loadSourceConfig } from "@/lib/sources/sourceConfigLoader";
import { parseManualFile, type ManualRecord } from "@/lib/sources/tabularParser";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { writeProcessedMetrics } from "@/lib/pipeline/metrics";
import { validateMetricProvenance } from "@/lib/provenance/provenanceValidator";
import type { SourceAdapter } from "../SourceAdapter";

type ProcessedMetricsFile = {
  metrics: MetricValue[];
};

function parseValue(value: string): MetricValue["value"] {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return trimmed;
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function findField(record: ManualRecord, names: string[]): string {
  for (const name of names) {
    if (record[name] !== undefined) {
      return String(record[name]);
    }
  }

  return "";
}

export class ManualFileAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private rawFiles: string[] = [];
  private retrievedAt = new Date().toISOString();

  constructor(public sourceId: string) {}

  async fetchRaw(): Promise<void> {
    this.config = await loadSourceConfig(this.sourceId);
    const manualFiles = await findManualImportFiles(this.config);
    const archived = await archiveManualImportFiles(this.config, manualFiles);
    this.rawFiles = archived.archivedFiles;
  }

  async normalize(): Promise<void> {
    if (!this.config) {
      this.config = await loadSourceConfig(this.sourceId);
    }

    if (this.rawFiles.length === 0) {
      return;
    }

    const metricsByCountry = new Map<string, MetricValue[]>();

    for (const rawFile of this.rawFiles) {
      const records = await parseManualFile(rawFile);

      for (const [index, record] of records.entries()) {
        const metric = this.recordToMetric(record, rawFile, index);

        if (!metric || metric.country_code === "WLD") {
          continue;
        }

        metricsByCountry.set(metric.country_code, [
          ...(metricsByCountry.get(metric.country_code) ?? []),
          metric,
        ]);
      }

      for (const metric of this.buildDerivedMetrics(records, rawFile)) {
        metricsByCountry.set(metric.country_code, [
          ...(metricsByCountry.get(metric.country_code) ?? []),
          metric,
        ]);
      }
    }

    const requiredMetricIds = getSourceMetricDefinitions(this.sourceId)
      .filter((definition) => definition.required)
      .map((definition) => definition.metric_id);

    for (const [countryCode, metrics] of metricsByCountry.entries()) {
      await writeProcessedMetrics(countryCode, metrics, this.retrievedAt, requiredMetricIds);
      console.log(`${this.sourceId}: updated ${countryCode} with ${metrics.length} metric(s)`);
    }
  }

  async validate(): Promise<void> {
    const warnings: string[] = [];

    for (const countryCode of await this.countriesWithSourceMetrics()) {
      const processed = await readJsonFile<ProcessedMetricsFile>(
        repoPath("data", "processed", "countries", countryCode, "metrics.v1.json"),
      );
      const sourceMetrics = processed.metrics.filter((metric) => metric.source_id === this.sourceId);

      for (const metric of sourceMetrics) {
        warnings.push(...validateMetricProvenance(metric, `${countryCode}:${metric.metric_id}`).warnings);
      }

      if (this.sourceId === "world_values_survey") {
        for (const metric of sourceMetrics) {
          if ((metric.sample_size ?? 0) > 0 && (metric.sample_size ?? 0) < 100) {
            warnings.push(`${countryCode}:${metric.metric_id}: demographic sample size is below 100`);
          }
        }
      }
    }

    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }
  }

  private recordToMetric(record: ManualRecord, rawFile: string, index: number): MetricValue | null {
    const countryCode = mapToIso3(findField(record, ["country_code", "country_iso3", "iso3", "refArea", "country"]));
    const metricId = findField(record, ["metric_id", "indicator", "indicator_id"]);

    if (!countryCode || !metricId) {
      return null;
    }

    const definition = getSourceMetricDefinition(this.sourceId, metricId);

    if (!definition) {
      return null;
    }

    const year = parseOptionalNumber(findField(record, ["year", "time_period", "date"]));
    const sourceUrl = findField(record, ["source_url", "url"]) || this.config?.api_base_url || "";
    const sampleSize = parseOptionalNumber(findField(record, ["sample_size", "n"]));

    const metric = buildMetricWithProvenance({
      metric_id: metricId,
      country_code: countryCode,
      value: parseValue(findField(record, ["value", "obs_value", "metric_value"])),
      unit: findField(record, ["unit"]) || definition.unit,
      year,
      source_id: this.sourceId,
      source_name: findField(record, ["source_name"]) || this.sourceId,
      source_url: sourceUrl,
      retrieved_at: this.retrievedAt,
      raw_file_path: toPublicDataPath(rawFile),
      raw_record_id: findField(record, ["raw_record_id", "record_id"]) || buildRawRecordId([path.basename(rawFile), String(index + 1), metricId]),
      calculation: findField(record, ["calculation"]) || definition.metric_id,
      confidence: "medium",
      freshness_requirement: definition.freshness_requirement,
      freshness_status: calculateFreshnessStatus(year, definition.freshness_requirement),
      notes: findField(record, ["notes"]),
      input_metric_ids: undefined,
    });

    metric.sample_size = sampleSize;
    metric.question_wording = findField(record, ["question_wording"]) || null;
    metric.response_mapping = findField(record, ["response_mapping"]) || null;
    metric.demographic_cut = findField(record, ["demographic_cut"]) || null;
    metric.demographic_group = findField(record, ["demographic_group"]) || null;

    return metric;
  }

  private buildDerivedMetrics(records: ManualRecord[], rawFile: string): MetricValue[] {
    if (this.sourceId !== "un_comtrade") {
      return [];
    }

    const baseMetrics = records
      .map((record, index) => this.recordToMetric(record, rawFile, index))
      .filter((metric): metric is MetricValue => metric !== null);
    const byCountryYear = new Map<string, MetricValue[]>();

    for (const metric of baseMetrics) {
      byCountryYear.set(`${metric.country_code}:${metric.year ?? "unknown"}`, [
        ...(byCountryYear.get(`${metric.country_code}:${metric.year ?? "unknown"}`) ?? []),
        metric,
      ]);
    }

    const derived: MetricValue[] = [];

    for (const [key, metrics] of byCountryYear.entries()) {
      const [countryCode, year] = key.split(":");

      if (countryCode === "WLD") {
        continue;
      }

      const exportsMetric = metrics.find((metric) => metric.metric_id === "exports_total_usd");
      const importsMetric = metrics.find((metric) => metric.metric_id === "imports_total_usd");
      const worldMetrics = byCountryYear.get(`WLD:${year}`) ?? [];
      const worldExports = worldMetrics.find((metric) => metric.metric_id === "exports_total_usd");
      const worldImports = worldMetrics.find((metric) => metric.metric_id === "imports_total_usd");

      if (exportsMetric && importsMetric && typeof exportsMetric.value === "number" && typeof importsMetric.value === "number") {
        derived.push({
          ...exportsMetric,
          metric_id: "trade_balance_usd",
          value: exportsMetric.value - importsMetric.value,
          unit: "current_usd",
          source_id: "derived_from_un_comtrade",
          source_name: "Derived from UN Comtrade",
          calculation: "exports_total_usd - imports_total_usd",
          input_metric_ids: ["exports_total_usd", "imports_total_usd"],
          raw_record_id: buildRawRecordId(["trade_balance_usd", exportsMetric.raw_record_id ?? "", importsMetric.raw_record_id ?? ""]),
          notes: "Derived from exports_total_usd and imports_total_usd.",
        });
      }

      const exportShare = exportsMetric && worldExports ? calculateWorldShare(exportsMetric, worldExports, "exports_world_share_percent") : null;
      const importShare = importsMetric && worldImports ? calculateWorldShare(importsMetric, worldImports, "imports_world_share_percent") : null;

      if (exportShare) {
        derived.push({ ...exportShare, source_id: "derived_from_un_comtrade" });
      }
      if (importShare) {
        derived.push({ ...importShare, source_id: "derived_from_un_comtrade" });
      }
    }

    return derived;
  }

  private async countriesWithSourceMetrics(): Promise<string[]> {
    const countries = new Set<string>();

    for (const rawFile of this.rawFiles) {
      for (const record of await parseManualFile(rawFile)) {
        const countryCode = mapToIso3(findField(record, ["country_code", "country_iso3", "iso3", "refArea", "country"]));

        if (countryCode && countryCode !== "WLD") {
          countries.add(countryCode);
        }
      }
    }

    return [...countries].sort();
  }
}
