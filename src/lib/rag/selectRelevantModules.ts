const DEFAULT_COUNTRY_MODULES = ["identity_foundation", "history", "economy", "foreign_policy", "scorecard"];
const DEFAULT_RELATIONSHIP_MODULES = ["relationship", "game_theory_relationship"];

type RelevantModules = {
  countryModules: string[];
  relationshipModules: string[];
  topics: string[];
};

const QUESTION_MODULE_MAP: Array<{
  topic: string;
  keywords: string[];
  countryModules: string[];
  relationshipModules: string[];
}> = [
  {
    topic: "crime",
    keywords: ["crime", "homicide", "safety", "police", "violence"],
    countryModules: ["crime_safety", "government_current", "population_divisions"],
    relationshipModules: ["relationship"],
  },
  {
    topic: "trade",
    keywords: ["trade", "export", "import", "tariff", "supply chain", "shipping"],
    countryModules: ["trade_exports_imports", "economy", "logistics_shipping_air_travel"],
    relationshipModules: ["trade_relationship", "relationship"],
  },
  {
    topic: "immigration",
    keywords: ["immigration", "migrant", "diaspora", "assimilation", "foreign-born"],
    countryModules: ["demographic_change", "cultural_assimilation", "national_cohesion_by_demographic"],
    relationshipModules: ["relationship"],
  },
  {
    topic: "war",
    keywords: ["war", "invade", "attack", "military", "escalate", "fight", "deterrence"],
    countryModules: ["military", "foreign_policy", "game_theory_profile"],
    relationshipModules: ["relationship", "military_relationship", "game_theory_relationship"],
  },
  {
    topic: "leader",
    keywords: ["leader", "president", "prime minister", "ruling class", "elite", "regime"],
    countryModules: ["government_current", "ruling_class", "leader_dossiers"],
    relationshipModules: ["relationship", "game_theory_relationship"],
  },
  {
    topic: "nationalism",
    keywords: ["nationalism", "cohesion", "national pride", "identity", "separatist"],
    countryModules: ["nationalism_cohesion", "national_cohesion_by_demographic", "population_divisions"],
    relationshipModules: ["rivalry_narratives", "game_theory_relationship"],
  },
  {
    topic: "technology",
    keywords: ["technology", "patent", "ai", "semiconductor", "research", "innovation"],
    countryModules: ["technology_contributions", "economy", "education"],
    relationshipModules: ["trade_relationship", "relationship"],
  },
];

export function selectRelevantModules(question: string): RelevantModules {
  const normalizedQuestion = question.toLowerCase();
  const matches = QUESTION_MODULE_MAP.filter((entry) =>
    entry.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
  );

  return {
    countryModules: Array.from(
      new Set([
        ...DEFAULT_COUNTRY_MODULES,
        ...matches.flatMap((match) => match.countryModules),
      ]),
    ),
    relationshipModules: Array.from(
      new Set([
        ...DEFAULT_RELATIONSHIP_MODULES,
        ...matches.flatMap((match) => match.relationshipModules),
      ]),
    ),
    topics: matches.map((match) => match.topic),
  };
}
