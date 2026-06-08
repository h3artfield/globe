import type { AcquisitionSlot, KbSourceType } from "@/types/kb";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";

const ALL_COUNTRY_TARGETS = [...MVP_COUNTRIES];
const ALL_RELATIONSHIP_TARGETS = MVP_RELATIONSHIP_PAIRS.map(([a, b]) => buildRelationshipId(a, b));

type SharedDatasetDef = {
  shared_source_id: string;
  source_title: string;
  source_org: string;
  source_type: KbSourceType;
  expected_folder: string;
  expected_filename: string;
  country_modules: string[];
  relationship_modules: string[];
  applies_to_countries?: string[];
  applies_to_relationships?: string[];
  priority: number;
  notes: string;
};

const SHARED_DATASETS: SharedDatasetDef[] = [
  {
    shared_source_id: "vdem_country_year",
    source_title: "V-Dem Country-Year Dataset",
    source_org: "V-Dem Institute",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/vdem",
    expected_filename: "vdem_country_year.csv",
    country_modules: ["government_current", "media_information", "population_divisions"],
    relationship_modules: [],
    priority: 95,
    notes: "Single shared export filtered by country_text_id per MVP country.",
  },
  {
    shared_source_id: "un_comtrade_bilateral",
    source_title: "UN Comtrade Bilateral Trade Dataset",
    source_org: "UN Comtrade",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/un_comtrade",
    expected_filename: "un_comtrade_bilateral.csv",
    country_modules: ["trade_exports_imports", "economy"],
    relationship_modules: ["trade_relationship"],
    priority: 94,
    notes: "One shared file; filter reporter/partner rows per country or relationship pair.",
  },
  {
    shared_source_id: "acled_events",
    source_title: "ACLED Event Dataset",
    source_org: "ACLED",
    source_type: "dataset",
    expected_folder: "data/manual_imports/acled",
    expected_filename: "acled_events.csv",
    country_modules: ["national_event_timeline", "top_national_events_20_years", "news_memory", "crime_safety"],
    relationship_modules: ["relationship_event_timeline", "crisis_history", "military_relationship"],
    priority: 93,
    notes: "Single shared export; filter by country_codes and bilateral actors.",
  },
  {
    shared_source_id: "ucdp_conflict",
    source_title: "UCDP Conflict Dataset",
    source_org: "Uppsala Conflict Data Program",
    source_type: "dataset",
    expected_folder: "data/manual_imports/ucdp",
    expected_filename: "ucdp_conflict.csv",
    country_modules: ["adversaries_and_rivals", "military", "threat_perception"],
    relationship_modules: ["war_history", "crisis_history", "adversary_status"],
    priority: 92,
    notes: "Shared conflict metadata filtered per target.",
  },
  {
    shared_source_id: "unesco_uis_education",
    source_title: "UNESCO UIS Education Indicators",
    source_org: "UNESCO Institute for Statistics",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/unesco_uis",
    expected_filename: "unesco_uis_education.csv",
    country_modules: ["education"],
    relationship_modules: [],
    priority: 88,
    notes: "Shared UIS export with country ISO3 filter.",
  },
  {
    shared_source_id: "wipo_patents",
    source_title: "WIPO IP Statistics Export",
    source_org: "WIPO",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/wipo",
    expected_filename: "wipo_patents.csv",
    country_modules: ["technology_contributions"],
    relationship_modules: [],
    priority: 87,
    notes: "Shared patent statistics export.",
  },
  {
    shared_source_id: "unodc_crime",
    source_title: "UNODC Crime Statistics Export",
    source_org: "UNODC",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/unodc",
    expected_filename: "unodc_crime.csv",
    country_modules: ["crime_safety"],
    relationship_modules: [],
    priority: 86,
    notes: "Shared UNODC export filtered per country.",
  },
  {
    shared_source_id: "world_values_survey",
    source_title: "World Values Survey Country Crosstabs",
    source_org: "World Values Survey",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/world_values_survey",
    expected_filename: "wvs_country_crosstabs.csv",
    country_modules: ["nationalism_cohesion", "national_cohesion_by_demographic"],
    relationship_modules: [],
    priority: 85,
    notes: "Shared WVS wave export filtered per country.",
  },
  {
    shared_source_id: "correlates_of_war",
    source_title: "Correlates of War Alliance and War Data",
    source_org: "Correlates of War",
    source_type: "dataset",
    expected_folder: "data/manual_imports/correlates_of_war",
    expected_filename: "cow_alliances_wars.csv",
    country_modules: ["allies_and_partners", "history"],
    relationship_modules: ["alliance_status", "war_history", "diplomatic_history"],
    priority: 84,
    notes: "Shared COW tables for alliances and interstate wars.",
  },
  {
    shared_source_id: "oecd_pisa",
    source_title: "OECD PISA Results Export",
    source_org: "OECD",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/oecd_pisa",
    expected_filename: "oecd_pisa_scores.csv",
    country_modules: ["education"],
    relationship_modules: [],
    priority: 83,
    notes: "Shared PISA export for participating MVP countries.",
  },
  {
    shared_source_id: "unctad_trade",
    source_title: "UNCTAD Trade and Maritime Indicators",
    source_org: "UNCTAD",
    source_type: "international_dataset",
    expected_folder: "data/manual_imports/unctad",
    expected_filename: "unctad_trade_maritime.csv",
    country_modules: ["logistics_shipping_air_travel", "trade_exports_imports"],
    relationship_modules: ["trade_relationship"],
    priority: 82,
    notes: "Shared UNCTAD export filtered per country or pair.",
  },
];

type CountryOfficialSlot = {
  slot_id: string;
  module: string;
  source_title: string;
  source_org: string;
  source_type: KbSourceType;
  expected_filename: string;
  priority: number;
  notes: string;
};

const COUNTRY_STATS_ORGS: Record<string, string> = {
  USA: "US Census Bureau",
  CHN: "National Bureau of Statistics of China",
  EGY: "Central Agency for Public Mobilization and Statistics (CAPMAS)",
  ETH: "Ethiopian Statistical Service",
  RUS: "Federal State Statistics Service (Rosstat)",
  UKR: "State Statistics Service of Ukraine",
  IND: "Ministry of Statistics and Programme Implementation (MoSPI)",
  PAK: "Pakistan Bureau of Statistics",
  ISR: "Central Bureau of Statistics",
  IRN: "Statistical Center of Iran",
  SAU: "General Authority for Statistics (GASTAT)",
  TUR: "Turkish Statistical Institute (TUIK)",
};

const COUNTRY_MFA_ORGS: Record<string, string> = {
  USA: "US Department of State",
  CHN: "Ministry of Foreign Affairs of China",
  EGY: "Egyptian Ministry of Foreign Affairs",
  ETH: "Ethiopian Ministry of Foreign Affairs",
  RUS: "Russian Ministry of Foreign Affairs",
  UKR: "Ministry of Foreign Affairs of Ukraine",
  IND: "Ministry of External Affairs of India",
  PAK: "Ministry of Foreign Affairs of Pakistan",
  ISR: "Israeli Ministry of Foreign Affairs",
  IRN: "Ministry of Foreign Affairs of Iran",
  SAU: "Saudi Ministry of Foreign Affairs",
  TUR: "Turkish Ministry of Foreign Affairs",
};

const COUNTRY_DEFENSE_ORGS: Record<string, string> = {
  USA: "US Department of Defense",
  CHN: "Ministry of National Defense of China",
  EGY: "Egyptian Ministry of Defense",
  ETH: "Ethiopian Ministry of Defense",
  RUS: "Russian Ministry of Defence",
  UKR: "Ministry of Defence of Ukraine",
  IND: "Ministry of Defence of India",
  PAK: "Pakistan Ministry of Defence",
  ISR: "Israeli Ministry of Defense",
  IRN: "Islamic Republic of Iran Armed Forces General Staff",
  SAU: "Saudi Ministry of Defense",
  TUR: "Turkish Ministry of National Defence",
};

const COUNTRY_EXECUTIVE_ORGS: Record<string, string> = {
  USA: "The White House",
  CHN: "State Council of China",
  EGY: "Egyptian Presidency",
  ETH: "Office of the Prime Minister of Ethiopia",
  RUS: "Administration of the President of Russia",
  UKR: "Office of the President of Ukraine",
  IND: "Prime Minister's Office of India",
  PAK: "Prime Minister's Office of Pakistan",
  ISR: "Prime Minister's Office of Israel",
  IRN: "Presidency of the Islamic Republic of Iran",
  SAU: "Royal Court of Saudi Arabia",
  TUR: "Presidency of the Republic of Turkey",
};

const COUNTRY_OFFICIAL_SLOTS: CountryOfficialSlot[] = [
  {
    slot_id: "stats_yearbook",
    module: "demographics",
    source_title: "Official Statistical Yearbook Extract",
    source_org: "PLACEHOLDER",
    source_type: "official_primary",
    expected_filename: "official_statistical_yearbook.md",
    priority: 80,
    notes: "Government statistics agency yearbook or demographic bulletin with YAML frontmatter.",
  },
  {
    slot_id: "mfa_foreign_policy",
    module: "foreign_policy",
    source_title: "Ministry of Foreign Affairs Policy Paper",
    source_org: "PLACEHOLDER",
    source_type: "official_primary",
    expected_filename: "mfa_foreign_policy_paper.md",
    priority: 79,
    notes: "Official foreign ministry white paper or annual foreign policy statement.",
  },
  {
    slot_id: "defense_posture",
    module: "military",
    source_title: "Defense Ministry Strategy or Posture Statement",
    source_org: "PLACEHOLDER",
    source_type: "official_primary",
    expected_filename: "defense_strategy_statement.md",
    priority: 78,
    notes: "Official defense ministry strategy, posture statement, or white paper.",
  },
  {
    slot_id: "leader_office",
    module: "leader_dossiers",
    source_title: "Current Executive Office Official Biography",
    source_org: "PLACEHOLDER",
    source_type: "official_primary",
    expected_filename: "current_leader_official_bio.md",
    priority: 77,
    notes: "Official biography from executive office, parliament, or government portal.",
  },
];

type RelationshipOfficialSlot = {
  slot_id: string;
  module: string;
  source_title: string;
  source_type: KbSourceType;
  expected_filename: string;
  priority: number;
  notes: string;
};

const RELATIONSHIP_OFFICIAL_SLOTS: RelationshipOfficialSlot[] = [
  {
    slot_id: "treaty_framework",
    module: "diplomatic_history",
    source_title: "Founding Treaty or Diplomatic Framework Text",
    source_type: "treaty",
    expected_filename: "founding_treaty_or_framework.md",
    priority: 76,
    notes: "Official treaty, memorandum, or diplomatic framework between the pair.",
  },
  {
    slot_id: "sanctions_record",
    module: "adversary_status",
    source_title: "Official Sanctions or Restrictive Measures Record",
    source_type: "official_primary",
    expected_filename: "bilateral_sanctions_record.md",
    priority: 75,
    notes: "Official sanctions listing or government restrictive-measures notice.",
  },
  {
    slot_id: "trade_bilateral",
    module: "trade_relationship",
    source_title: "Official Bilateral Trade Statistics Release",
    source_type: "official_primary",
    expected_filename: "bilateral_trade_official_release.md",
    priority: 74,
    notes: "Official customs or trade ministry bilateral trade release.",
  },
  {
    slot_id: "crisis_statement",
    module: "crisis_history",
    source_title: "Official Crisis or Incident Statement",
    source_type: "official_primary",
    expected_filename: "bilateral_crisis_official_statement.md",
    priority: 73,
    notes: "Official government statement on a bilateral crisis or military incident.",
  },
];

const RELATIONSHIP_SHARED_IMPORTS: SharedDatasetDef[] = [
  {
    shared_source_id: "treaties_manual",
    source_title: "Manual Treaty and Alliance Registry",
    source_org: "Manual treaty registry",
    source_type: "treaty",
    expected_folder: "data/manual_imports/treaties_manual",
    expected_filename: "treaties_alliances.csv",
    country_modules: ["allies_and_partners"],
    relationship_modules: ["alliance_status", "diplomatic_history"],
    applies_to_relationships: ALL_RELATIONSHIP_TARGETS,
    priority: 81,
    notes: "Shared treaty registry filtered per relationship pair.",
  },
  {
    shared_source_id: "sanctions_manual",
    source_title: "Manual Sanctions Relationship Registry",
    source_org: "Manual sanctions registry",
    source_type: "dataset",
    expected_folder: "data/manual_imports/sanctions",
    expected_filename: "sanctions_relationships.csv",
    country_modules: ["adversaries_and_rivals"],
    relationship_modules: ["adversary_status", "trade_relationship"],
    applies_to_relationships: ALL_RELATIONSHIP_TARGETS,
    priority: 80,
    notes: "Shared sanctions export filtered per relationship pair.",
  },
  {
    shared_source_id: "un_voting_alignment",
    source_title: "UN Voting Alignment Dataset",
    source_org: "UN Voting Data",
    source_type: "dataset",
    expected_folder: "data/manual_imports/un_voting",
    expected_filename: "un_voting_alignment.csv",
    country_modules: ["foreign_policy"],
    relationship_modules: ["relationship", "diplomatic_history"],
    applies_to_relationships: ALL_RELATIONSHIP_TARGETS,
    priority: 79,
    notes: "Shared UN voting dataset with pair-level agreement scores.",
  },
];

function buildSharedSlot(dataset: SharedDatasetDef): AcquisitionSlot {
  const targetMappings = [
    ...ALL_COUNTRY_TARGETS.filter((code) => !dataset.applies_to_countries || dataset.applies_to_countries.includes(code)).map(
      (code) => ({
        target_id: code,
        target_type: "country" as const,
        modules: dataset.country_modules,
      }),
    ),
    ...(dataset.applies_to_relationships ?? ALL_RELATIONSHIP_TARGETS).map((relationshipId) => ({
      target_id: relationshipId,
      target_type: "relationship" as const,
      modules: dataset.relationship_modules,
    })),
  ].filter((mapping) => mapping.modules.length > 0);

  return {
    queue_id: `shared-${dataset.shared_source_id}`,
    shared_source_id: dataset.shared_source_id,
    applies_to_targets: targetMappings.map((mapping) => mapping.target_id),
    target_mappings: targetMappings,
    module: dataset.country_modules[0] ?? dataset.relationship_modules[0] ?? "scorecard",
    modules_supported: [...new Set([...dataset.country_modules, ...dataset.relationship_modules])],
    source_title: dataset.source_title,
    source_org: dataset.source_org,
    source_type: dataset.source_type,
    expected_folder: dataset.expected_folder,
    expected_filename: dataset.expected_filename,
    priority: dataset.priority,
    notes: dataset.notes,
  };
}

export function getSharedAcquisitionSlots(): AcquisitionSlot[] {
  return [...SHARED_DATASETS, ...RELATIONSHIP_SHARED_IMPORTS].map(buildSharedSlot);
}

function countryOrgForSlot(countryCode: string, slotId: string): string {
  if (slotId === "stats_yearbook") {
    return COUNTRY_STATS_ORGS[countryCode] ?? `${countryCode} official statistics agency`;
  }
  if (slotId === "mfa_foreign_policy") {
    return COUNTRY_MFA_ORGS[countryCode] ?? `${countryCode} foreign ministry`;
  }
  if (slotId === "defense_posture") {
    return COUNTRY_DEFENSE_ORGS[countryCode] ?? `${countryCode} defense ministry`;
  }
  if (slotId === "leader_office") {
    return COUNTRY_EXECUTIVE_ORGS[countryCode] ?? `${countryCode} executive office`;
  }
  return `${countryCode} official source`;
}

export function getCountryAcquisitionSlots(countryCode: string): AcquisitionSlot[] {
  return COUNTRY_OFFICIAL_SLOTS.map((slot) => ({
    queue_id: `${countryCode}-${slot.slot_id}`,
    target_id: countryCode,
    target_type: "country" as const,
    module: slot.module,
    source_title: slot.source_title,
    source_org: slot.source_org === "PLACEHOLDER" ? countryOrgForSlot(countryCode, slot.slot_id) : slot.source_org,
    source_type: slot.source_type,
    expected_folder: `data/manual_sources/countries/${countryCode}`,
    expected_filename: slot.expected_filename,
    priority: slot.priority,
    notes: slot.notes,
  }));
}

export function getRelationshipAcquisitionSlots(relationshipId: string): AcquisitionSlot[] {
  return RELATIONSHIP_OFFICIAL_SLOTS.map((slot) => ({
    queue_id: `${relationshipId}-${slot.slot_id}`,
    target_id: relationshipId,
    target_type: "relationship" as const,
    module: slot.module,
    source_title: slot.source_title,
    source_org: `${relationshipId} bilateral official record`,
    source_type: slot.source_type,
    expected_folder: `data/manual_sources/relationships/${relationshipId}`,
    expected_filename: slot.expected_filename,
    priority: slot.priority,
    notes: slot.notes,
  }));
}

export function getAllAcquisitionSlots(): AcquisitionSlot[] {
  const shared = getSharedAcquisitionSlots();
  const country = ALL_COUNTRY_TARGETS.flatMap((code) => getCountryAcquisitionSlots(code));
  const relationship = ALL_RELATIONSHIP_TARGETS.flatMap((id) => getRelationshipAcquisitionSlots(id));
  return [...shared, ...country, ...relationship];
}

export function slotsForTargetModule(
  targetType: "country" | "relationship",
  targetId: string,
  moduleName: string,
): AcquisitionSlot[] {
  return getAllAcquisitionSlots().filter((slot) => {
    if (slot.shared_source_id && slot.target_mappings) {
      return slot.target_mappings.some(
        (mapping) =>
          mapping.target_id === targetId &&
          mapping.target_type === targetType &&
          mapping.modules.includes(moduleName),
      );
    }
    return slot.target_id === targetId && slot.target_type === targetType && slot.module === moduleName;
  });
}

export function bestSlotForModule(
  targetType: "country" | "relationship",
  targetId: string,
  moduleName: string,
): AcquisitionSlot | null {
  const matches = slotsForTargetModule(targetType, targetId, moduleName);
  return matches.sort((a, b) => b.priority - a.priority)[0] ?? null;
}
