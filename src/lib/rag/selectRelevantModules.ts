const DEFAULT_COUNTRY_MODULES = ["identity_foundation", "history", "economy", "foreign_policy", "scorecard", "manual_source_documents"];
const DEFAULT_RELATIONSHIP_MODULES = ["relationship", "game_theory_relationship", "manual_source_documents"];

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
    keywords: ["trade", "export", "exports", "import", "imports", "tariff", "supply chain", "shipping", "oil"],
    countryModules: ["trade_exports_imports", "economy", "logistics_shipping_air_travel", "scorecard"],
    relationshipModules: ["trade_relationship", "relationship"],
  },
  {
    topic: "immigration",
    keywords: ["immigration", "migrant", "diaspora", "assimilation", "foreign-born", "demographic", "divisions"],
    countryModules: ["demographics", "demographic_change", "cultural_assimilation", "national_cohesion_by_demographic", "population_divisions"],
    relationshipModules: ["relationship"],
  },
  {
    topic: "war",
    keywords: ["war", "invade", "attack", "military", "escalate", "fight", "deterrence", "crisis", "risk", "risks"],
    countryModules: ["adversaries_and_rivals", "military", "foreign_policy", "game_theory_profile"],
    relationshipModules: ["relationship", "relationship_event_timeline", "military_relationship", "game_theory_relationship", "crisis_history", "war_history"],
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
    keywords: ["technology", "contribution", "patent", "ai", "semiconductor", "research", "innovation"],
    countryModules: ["technology_contributions", "economy", "education"],
    relationshipModules: ["trade_relationship", "relationship"],
  },
  {
    topic: "allies",
    keywords: ["ally", "allies", "alliance", "partner", "partners", "protects", "bases", "intelligence sharing"],
    countryModules: ["allies_and_partners", "foreign_policy"],
    relationshipModules: ["relationship", "alliance_status", "diplomatic_history"],
  },
  {
    topic: "enemies",
    keywords: ["enemy", "enemies", "adversary", "adversaries", "rival", "rivals", "threat", "sanction", "sanctions"],
    countryModules: ["adversaries_and_rivals", "threat_perception"],
    relationshipModules: ["relationship", "adversary_status", "rivalry_narratives", "crisis_history"],
  },
  {
    topic: "events",
    keywords: ["news", "event", "events", "timeline", "top events", "past 20 years", "scandal", "protest"],
    countryModules: ["top_national_events_20_years", "national_event_timeline", "news_memory", "history"],
    relationshipModules: ["relationship_event_timeline", "crisis_history", "diplomatic_history"],
  },
  {
    topic: "relationship",
    keywords: ["relationship", "relations", "between"],
    countryModules: ["foreign_policy", "history"],
    relationshipModules: ["relationship", "relationship_event_timeline", "crisis_history", "war_history", "diplomatic_history"],
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
