import type { FreshnessRequirement } from "@/types/pipeline";

export type SourceMetricDefinition = {
  metric_id: string;
  label: string;
  module: string;
  unit: string;
  freshness_requirement: FreshnessRequirement;
  required: boolean;
};

const COMMON_ANNUAL: FreshnessRequirement = "annual";
const LATEST: FreshnessRequirement = "latest_available_year";

export const SOURCE_METRIC_DEFINITIONS: Record<string, SourceMetricDefinition[]> = {
  world_bank_wdi: [
    { metric_id: "gdp_current_usd", label: "GDP", module: "economy", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "gdp_per_capita_current_usd", label: "GDP per capita", module: "economy", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "gdp_ppp_current_international", label: "GDP PPP", module: "economy", unit: "current_international_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "population_total", label: "Population", module: "demographics", unit: "people", freshness_requirement: LATEST, required: true },
    { metric_id: "urban_population_share", label: "Urban population share", module: "demographics", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "fertility_rate", label: "Fertility rate", module: "demographic_change", unit: "births_per_woman", freshness_requirement: LATEST, required: true },
    { metric_id: "life_expectancy", label: "Life expectancy", module: "average_citizen_life", unit: "years", freshness_requirement: LATEST, required: true },
    { metric_id: "exports_goods_services_current_usd", label: "Exports goods and services", module: "trade_exports_imports", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "imports_goods_services_current_usd", label: "Imports goods and services", module: "trade_exports_imports", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "homicide_rate_per_100k", label: "Homicide rate", module: "crime_safety", unit: "per_100k", freshness_requirement: LATEST, required: false },
    { metric_id: "military_expenditure_current_usd", label: "Military expenditure", module: "military", unit: "current_usd", freshness_requirement: LATEST, required: true },
  ],
  un_comtrade: [
    { metric_id: "exports_total_usd", label: "Exports total", module: "trade_exports_imports", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "imports_total_usd", label: "Imports total", module: "trade_exports_imports", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "trade_balance_usd", label: "Trade balance", module: "trade_exports_imports", unit: "current_usd", freshness_requirement: LATEST, required: true },
    { metric_id: "top_export_products", label: "Top export products", module: "trade_exports_imports", unit: "json", freshness_requirement: LATEST, required: true },
    { metric_id: "top_import_products", label: "Top import products", module: "trade_exports_imports", unit: "json", freshness_requirement: LATEST, required: true },
    { metric_id: "top_export_partners", label: "Top export partners", module: "trade_exports_imports", unit: "json", freshness_requirement: LATEST, required: true },
    { metric_id: "top_import_partners", label: "Top import partners", module: "trade_exports_imports", unit: "json", freshness_requirement: LATEST, required: true },
    { metric_id: "exports_world_share_percent", label: "Exports world share", module: "trade_exports_imports", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "imports_world_share_percent", label: "Imports world share", module: "trade_exports_imports", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "export_concentration_score", label: "Export concentration score", module: "trade_exports_imports", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "import_dependency_score", label: "Import dependency score", module: "trade_exports_imports", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "strategic_import_dependencies", label: "Strategic import dependencies", module: "trade_exports_imports", unit: "json", freshness_requirement: LATEST, required: false },
  ],
  unodc: [
    { metric_id: "homicide_count", label: "Homicide count", module: "crime_safety", unit: "count", freshness_requirement: LATEST, required: true },
    { metric_id: "homicide_rate_per_100k", label: "Homicide rate", module: "crime_safety", unit: "per_100k", freshness_requirement: LATEST, required: true },
    { metric_id: "violent_crime_rate", label: "Violent crime rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "robbery_rate", label: "Robbery rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "assault_rate", label: "Assault rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "sexual_violence_rate", label: "Sexual violence rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "kidnapping_rate", label: "Kidnapping rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "prison_population_total", label: "Prison population total", module: "crime_safety", unit: "people", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "prison_population_rate_per_100k", label: "Prison population rate", module: "crime_safety", unit: "per_100k", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "drug_seizure_indicators", label: "Drug seizure indicators", module: "crime_safety", unit: "json", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "human_trafficking_indicators", label: "Human trafficking indicators", module: "crime_safety", unit: "json", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "firearms_trafficking_indicators", label: "Firearms trafficking indicators", module: "crime_safety", unit: "json", freshness_requirement: COMMON_ANNUAL, required: false },
  ],
  un_desa_migrant_stock: [
    { metric_id: "international_migrant_stock_total", label: "International migrant stock total", module: "demographic_change", unit: "people", freshness_requirement: LATEST, required: true },
    { metric_id: "foreign_born_population_share", label: "Foreign-born population share", module: "demographic_change", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "migrant_stock_by_origin_country", label: "Migrant stock by origin country", module: "demographic_change", unit: "json", freshness_requirement: LATEST, required: false },
    { metric_id: "migrant_stock_by_sex", label: "Migrant stock by sex", module: "demographic_change", unit: "json", freshness_requirement: LATEST, required: false },
    { metric_id: "migrant_stock_by_age_group", label: "Migrant stock by age group", module: "demographic_change", unit: "json", freshness_requirement: LATEST, required: false },
    { metric_id: "refugee_stock_where_available", label: "Refugee stock where available", module: "demographic_change", unit: "people", freshness_requirement: LATEST, required: false },
    { metric_id: "net_migration_where_available", label: "Net migration where available", module: "demographic_change", unit: "people", freshness_requirement: LATEST, required: false },
  ],
  vdem: [
    { metric_id: "regime_type", label: "Regime type", module: "government_current", unit: "category", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "electoral_democracy_index", label: "Electoral democracy index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "liberal_democracy_index", label: "Liberal democracy index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "participatory_democracy_index", label: "Participatory democracy index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "deliberative_democracy_index", label: "Deliberative democracy index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "egalitarian_democracy_index", label: "Egalitarian democracy index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "civil_liberties_index", label: "Civil liberties index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "rule_of_law_index", label: "Rule of law index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "judicial_constraints_index", label: "Judicial constraints index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "legislative_constraints_index", label: "Legislative constraints index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "political_corruption_index", label: "Political corruption index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "media_freedom_index", label: "Media freedom index", module: "media_information", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
    { metric_id: "academic_freedom_index", label: "Academic freedom index", module: "education", unit: "index", freshness_requirement: COMMON_ANNUAL, required: false },
    { metric_id: "election_fairness_index", label: "Election fairness index", module: "government_current", unit: "index", freshness_requirement: COMMON_ANNUAL, required: true },
  ],
  world_values_survey: [
    { metric_id: "national_pride_score", label: "National pride score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: true },
    { metric_id: "willingness_to_fight_score", label: "Willingness to fight score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: true },
    { metric_id: "trust_government_score", label: "Trust government score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: true },
    { metric_id: "trust_military_score", label: "Trust military score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: true },
    { metric_id: "trust_police_score", label: "Trust police score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: true },
    { metric_id: "trust_courts_score", label: "Trust courts score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "attachment_to_country_score", label: "Attachment to country score", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "religious_identity_strength", label: "Religious identity strength", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "support_for_immigration", label: "Support for immigration", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "support_for_traditional_values", label: "Support for traditional values", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "desire_to_emigrate", label: "Desire to emigrate", module: "nationalism_cohesion", unit: "score", freshness_requirement: "static_or_historical", required: false },
  ],
  wipo: [
    { metric_id: "patent_applications_resident", label: "Patent applications resident", module: "technology_contributions", unit: "applications", freshness_requirement: LATEST, required: true },
    { metric_id: "patent_applications_nonresident", label: "Patent applications nonresident", module: "technology_contributions", unit: "applications", freshness_requirement: LATEST, required: false },
    { metric_id: "pct_applications", label: "PCT applications", module: "technology_contributions", unit: "applications", freshness_requirement: LATEST, required: true },
    { metric_id: "trademark_applications", label: "Trademark applications", module: "technology_contributions", unit: "applications", freshness_requirement: LATEST, required: false },
    { metric_id: "industrial_design_applications", label: "Industrial design applications", module: "technology_contributions", unit: "applications", freshness_requirement: LATEST, required: false },
    { metric_id: "patent_world_share_percent", label: "Patent world share", module: "technology_contributions", unit: "percent", freshness_requirement: LATEST, required: false },
    { metric_id: "pct_world_share_percent", label: "PCT world share", module: "technology_contributions", unit: "percent", freshness_requirement: LATEST, required: false },
  ],
  unesco_uis: [
    { metric_id: "literacy_rate", label: "Literacy rate", module: "education", unit: "percent", freshness_requirement: LATEST, required: true },
    { metric_id: "primary_completion_rate", label: "Primary completion rate", module: "education", unit: "percent", freshness_requirement: LATEST, required: false },
    { metric_id: "secondary_completion_rate", label: "Secondary completion rate", module: "education", unit: "percent", freshness_requirement: LATEST, required: false },
    { metric_id: "tertiary_enrollment_rate", label: "Tertiary enrollment rate", module: "education", unit: "percent", freshness_requirement: LATEST, required: false },
    { metric_id: "mean_years_schooling", label: "Mean years schooling", module: "education", unit: "years", freshness_requirement: LATEST, required: false },
    { metric_id: "education_spending_percent_gdp", label: "Education spending percent GDP", module: "education", unit: "percent_gdp", freshness_requirement: LATEST, required: false },
  ],
  oecd_pisa: [
    { metric_id: "pisa_math_score", label: "PISA math score", module: "education", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "pisa_reading_score", label: "PISA reading score", module: "education", unit: "score", freshness_requirement: "static_or_historical", required: false },
    { metric_id: "pisa_science_score", label: "PISA science score", module: "education", unit: "score", freshness_requirement: "static_or_historical", required: false },
  ],
  unctad: [
    { metric_id: "container_port_throughput", label: "Container port throughput", module: "logistics_shipping_air_travel", unit: "TEU", freshness_requirement: LATEST, required: false },
    { metric_id: "liner_shipping_connectivity_index", label: "Liner shipping connectivity index", module: "logistics_shipping_air_travel", unit: "index", freshness_requirement: LATEST, required: true },
    { metric_id: "merchant_fleet_deadweight_tonnage", label: "Merchant fleet deadweight tonnage", module: "logistics_shipping_air_travel", unit: "deadweight_tons", freshness_requirement: LATEST, required: false },
    { metric_id: "fdi_inflows_usd", label: "FDI inflows", module: "economy", unit: "current_usd", freshness_requirement: LATEST, required: false },
    { metric_id: "fdi_outflows_usd", label: "FDI outflows", module: "economy", unit: "current_usd", freshness_requirement: LATEST, required: false },
    { metric_id: "tourism_exports_usd", label: "Tourism exports", module: "logistics_shipping_air_travel", unit: "current_usd", freshness_requirement: LATEST, required: false },
    { metric_id: "trade_openness", label: "Trade openness", module: "trade_exports_imports", unit: "percent_gdp", freshness_requirement: LATEST, required: true },
  ],
};

export function getSourceMetricDefinitions(sourceId: string): SourceMetricDefinition[] {
  return SOURCE_METRIC_DEFINITIONS[sourceId] ?? [];
}

export function getSourceMetricDefinition(
  sourceId: string,
  metricId: string,
): SourceMetricDefinition | null {
  return getSourceMetricDefinitions(sourceId).find((definition) => definition.metric_id === metricId) ?? null;
}
