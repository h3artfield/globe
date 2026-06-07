import type { IndicatorRegistryEntry, MetricValue } from "@/types/pipeline";

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
): MetricValue {
  const latestObservation = observations
    .filter((observation) => observation.value !== null && observation.value !== undefined)
    .sort((a, b) => Number(b.date ?? 0) - Number(a.date ?? 0))[0];

  return {
    metric_id: indicator.metric_id,
    country_code: countryCode,
    value: latestObservation?.value ?? null,
    unit: indicator.unit,
    year: latestObservation?.date ? Number(latestObservation.date) : null,
    source_name: "world_bank_wdi",
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
    calculation: indicator.formula || indicator.source_indicator_code || null,
    confidence: latestObservation ? "medium" : "unknown",
    freshness_requirement: indicator.freshness_requirement,
    notes: latestObservation
      ? `Latest non-null World Bank observation for ${indicator.source_indicator_code}.`
      : `No non-null World Bank observation returned for ${indicator.source_indicator_code}.`,
  };
}
