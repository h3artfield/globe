import type { IndicatorRegistryEntry, MetricValue } from "@/types/pipeline";
import { buildMetricWithProvenance } from "@/lib/provenance/provenanceBuilder";
import { buildRawRecordId } from "@/lib/provenance/sourceRecord";
import { calculateFreshnessStatus } from "@/lib/metrics/calculateFreshness";

type WorldBankObservation = {
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
};

type WorldBankApiResponse = [unknown, WorldBankObservation[]];

export async function fetchWorldBankIndicator(
  countryCode: string,
  indicatorCode: string,
): Promise<{ observations: WorldBankObservation[]; sourceUrl: string }> {
  const sourceUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&per_page=80`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  const response = await fetch(sourceUrl, { signal: controller.signal }).finally(() =>
    clearTimeout(timeout),
  );

  if (!response.ok) {
    throw new Error(`World Bank request failed for ${countryCode}/${indicatorCode}: ${response.status}`);
  }

  const body = (await response.json()) as WorldBankApiResponse;
  return {
    observations: Array.isArray(body[1]) ? body[1] : [],
    sourceUrl,
  };
}

export function latestWorldBankMetric(
  countryCode: string,
  indicator: IndicatorRegistryEntry,
  observations: WorldBankObservation[],
  sourceUrl: string,
  retrievedAt: string,
  rawFilePath: string,
): MetricValue {
  const latestObservation = observations
    .filter((observation) => observation.value !== null && observation.value !== undefined)
    .sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0))[0];

  return buildMetricWithProvenance({
    metric_id: indicator.metric_id,
    country_code: countryCode,
    value: latestObservation?.value ?? null,
    unit: indicator.unit,
    year: latestObservation?.date ? Number(latestObservation.date) : null,
    source_id: "world_bank_wdi",
    source_name: "world_bank_wdi",
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
    raw_file_path: rawFilePath,
    raw_record_id: buildRawRecordId([countryCode, indicator.metric_id, indicator.source_indicator_code ?? ""]),
    calculation: indicator.formula || indicator.source_indicator_code || null,
    confidence: latestObservation ? "medium" : "unknown",
    freshness_requirement: indicator.freshness_requirement,
    freshness_status: calculateFreshnessStatus(
      latestObservation?.date ? Number(latestObservation.date) : null,
      indicator.freshness_requirement,
    ),
    notes: latestObservation
      ? `Latest non-null World Bank observation for ${indicator.source_indicator_code}.`
      : `No non-null World Bank observation returned for ${indicator.source_indicator_code}.`,
  });
}
