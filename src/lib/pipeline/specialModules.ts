import type { CountryModule, MetricValue } from "@/types/pipeline";

export const DEMOGRAPHIC_CUTS = [
  "age_group",
  "sex",
  "education_level",
  "income_class",
  "urban_vs_rural",
  "region_province",
  "ethnicity",
  "language_group",
  "religion_sect",
  "native_born_vs_foreign_born",
  "citizen_vs_non_citizen",
  "immigrant_generation",
  "occupation_class",
  "public_sector_vs_private_sector",
  "majority_group_vs_minority_group",
  "capital_city_vs_provinces",
  "coastal_vs_inland",
  "elite_vs_working_class",
] as const;

export const COHESION_CONCEPTS = [
  "national_pride",
  "attachment_to_country",
  "willingness_to_fight_for_country",
  "trust_in_national_government",
  "trust_in_military",
  "trust_in_police",
  "trust_in_courts",
  "support_for_national_sovereignty",
  "support_for_border_control",
  "support_for_immigration",
  "support_for_assimilation",
  "culture_changing_too_fast",
  "minorities_mistreated",
  "majority_group_losing_power",
  "religious_identity_strength",
  "ethnic_identity_strength",
  "regional_identity_strength",
  "class_identity_strength",
  "separatist_sympathy",
  "regime_loyalty",
  "state_loyalty",
  "desire_to_emigrate",
] as const;

export function createNationalCohesionPayload(baseModule: CountryModule) {
  return {
    ...baseModule,
    required_demographic_cuts: DEMOGRAPHIC_CUTS,
    measured_concepts: COHESION_CONCEPTS,
    demographic_metrics: [],
    distinctions: [
      "regime loyalty is not the same as national loyalty",
      "ethnic pride is not the same as national pride",
      "religious identity is not the same as state loyalty",
      "anti-immigration sentiment is not nationalism by itself",
      "willingness to fight is not the same as trust in current government",
    ],
  };
}

export function createPopulationDivisionsPayload(baseModule: CountryModule) {
  return {
    ...baseModule,
    tracked_division_types: [
      "ethnic",
      "religious",
      "sectarian",
      "linguistic",
      "regional",
      "urban_rural",
      "class",
      "generational",
      "education",
      "gender",
      "caste_tribal_clan",
      "native_born_vs_immigrant",
      "ideological",
      "party",
      "military_vs_civilian",
      "capital_city_vs_province",
      "coastal_vs_inland",
      "resource_region_vs_tax_region",
      "globalized_elite_vs_local_working_class",
    ],
    divisions: [],
  };
}

export function createLeaderDossiersPayload(baseModule: CountryModule) {
  return {
    ...baseModule,
    profile_label: "behavioral profile based on public record",
    leaders: [],
    required_fields: [
      "full_name",
      "role",
      "current_office",
      "birthplace",
      "family_background",
      "education",
      "career_path",
      "military_background",
      "intelligence_background",
      "business_background",
      "ideology",
      "patronage_network",
      "allies",
      "rivals",
      "scandals",
      "life_story",
      "ruling_style",
      "risk_tolerance_based_on_public_behavior",
      "negotiation_style_based_on_public_behavior",
      "domestic_constraints",
      "foreign_constraints",
      "what_they_fear_losing",
      "what_they_want_to_be_remembered_for",
      "what_could_make_them_escalate",
      "what_could_make_them_compromise",
    ],
  };
}

export function createScorecardPayload(baseModule: CountryModule, metrics: MetricValue[]) {
  return {
    ...baseModule,
    scorecard: {
      country_code: baseModule.country_code,
      version: "1.0",
      last_updated: baseModule.last_updated,
      scores: [],
      metrics,
      methodology_notes: [
        "No composite scoring is calculated until scoring weights and source coverage are explicit.",
      ],
    },
  };
}
