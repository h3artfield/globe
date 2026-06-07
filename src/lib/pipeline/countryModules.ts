import type { CountryModule, MetricValue } from "@/types/pipeline";
import { COUNTRY_MODULES } from "./constants";

const METRIC_MODULE_OVERRIDES: Record<string, string> = {
  population_total: "demographics",
  urban_population_share: "demographics",
  fertility_rate: "demographic_change",
  life_expectancy: "average_citizen_life",
  net_migration: "demographic_change",
  gdp_current_usd: "economy",
  gdp_per_capita_current_usd: "economy",
  gdp_ppp_current_international: "economy",
  exports_goods_services_current_usd: "trade_exports_imports",
  imports_goods_services_current_usd: "trade_exports_imports",
  manufacturing_value_added_current_usd: "production_industry",
  agriculture_value_added_current_usd: "production_industry",
  energy_use_kg_oil_equivalent_per_capita: "production_industry",
  electric_power_consumption_kwh_per_capita: "production_industry",
  air_passengers_carried: "logistics_shipping_air_travel",
  air_freight_million_ton_km: "logistics_shipping_air_travel",
  tourism_arrivals: "logistics_shipping_air_travel",
  remittances_received_current_usd: "household_income_wealth",
  fdi_inflows_current_usd: "economy",
  poverty_rate_national: "household_income_wealth",
  youth_unemployment_rate: "household_income_wealth",
  gini_index: "household_income_wealth",
  literacy_rate_adult: "education",
  homicide_rate_per_100k: "crime_safety",
  military_expenditure_current_usd: "military",
  patent_applications_residents: "technology_contributions",
  high_technology_exports_current_usd: "technology_contributions",
  rd_expenditure_percent_gdp: "technology_contributions",
};

export function getMetricModule(metricId: string): string {
  return METRIC_MODULE_OVERRIDES[metricId] ?? "scorecard";
}

export function createCountryModule(
  countryCode: string,
  module: string,
  metrics: MetricValue[],
  generatedAt: string,
): CountryModule {
  const sourceIds = Array.from(
    new Set(metrics.map((metric) => metric.source_name).filter((source): source is string => !!source)),
  ).sort();

  return {
    country_code: countryCode,
    module,
    version: "1.0",
    last_updated: generatedAt.slice(0, 10),
    summary:
      metrics.length > 0
        ? `${module} has ${metrics.length} structured metric(s) with source metadata. Narrative claims are intentionally empty until sourced research is added.`
        : "",
    key_findings: metrics.map((metric) =>
      `${metric.metric_id}: ${metric.value ?? "missing"} ${metric.unit ?? ""} (${metric.year ?? "year unknown"})`,
    ),
    metrics,
    claims: [],
    open_questions:
      metrics.length > 0
        ? ["Add sourced narrative analysis and claim-level citations for this module."]
        : ["Populate this module with sourced metrics, claims, and narrative analysis."],
    source_ids: sourceIds,
    confidence: {
      overall: metrics.length > 0 ? "medium" : "unknown",
      weak_areas: metrics.length > 0 ? ["narrative_claims"] : ["metrics", "claims", "sources"],
    },
  };
}

export function createAllCountryModules(
  countryCode: string,
  metrics: MetricValue[],
  generatedAt: string,
): CountryModule[] {
  const metricsByModule = new Map<string, MetricValue[]>();

  for (const metric of metrics) {
    const module = getMetricModule(metric.metric_id);
    metricsByModule.set(module, [...(metricsByModule.get(module) ?? []), metric]);
  }

  return COUNTRY_MODULES.map((module) =>
    createCountryModule(countryCode, module, metricsByModule.get(module) ?? [], generatedAt),
  );
}
