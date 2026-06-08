import type { ModuleSourceRequirement } from "@/types/pilot";
import type { CountrySourceRequirementsFile, RelationshipSourceRequirementsFile } from "@/types/kb";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

const COUNTRY_TOPICS: Record<string, string[]> = {
  CHN: [
    "Indo-Pacific competition",
    "Taiwan policy",
    "economic statecraft",
    "party-state governance",
    "Belt and Road partnerships",
  ],
  EGY: [
    "Nile water security",
    "CAPMAS demographics",
    "regional mediation role",
    "military regional posture",
    "Suez Canal economy",
  ],
  ETH: [
    "GERD development",
    "African Union diplomacy",
    "ethnic federalism",
    "fast-growth demographics",
    "Horn of Africa security",
  ],
  RUS: [
    "sanctions exposure",
    "energy exports",
    "military posture",
    "authoritarian governance",
    "Eurasian integration",
  ],
  UKR: [
    "EU and NATO accession path",
    "wartime governance",
    "reconstruction planning",
    "territorial integrity",
    "defense partnerships",
  ],
  IND: [
    "Kashmir dispute",
    "Indo-Pacific strategy",
    "demographic dividend",
    "multiparty federalism",
    "technology and space programs",
  ],
  PAK: [
    "India rivalry",
    "military-civil balance",
    "CPEC corridor",
    "demographic youth bulge",
    "Afghanistan border security",
  ],
  ISR: [
    "security doctrine",
    "alliance network",
    "proportional representation politics",
    "technology economy",
    "regional normalization",
  ],
  IRN: [
    "nuclear program",
    "sanctions regime",
    "proxy strategy",
    "theocratic governance",
    "Gulf rivalry",
  ],
  SAU: [
    "Vision 2030 transition",
    "GCC leadership",
    "oil economy diversification",
    "Yemen involvement",
    "US security partnership",
  ],
  TUR: [
    "NATO role",
    "Syria operations",
    "economic volatility",
    "regional power aspirations",
    "Black Sea security",
  ],
};

const RELATIONSHIP_TOPICS: Record<string, string[]> = {
  CHN_USA: [
    "trade and technology competition",
    "Taiwan strait tensions",
    "military encounters",
    "UN voting divergence",
    "strategic rivalry narratives",
  ],
  RUS_UKR: [
    "Budapest Memorandum",
    "Minsk agreements",
    "2022 invasion and war",
    "sanctions packages",
    "ICJ and legal proceedings",
  ],
  IND_PAK: [
    "Kashmir dispute",
    "Line of Control",
    "Simla and Lahore agreements",
    "crisis escalation history",
    "nuclear deterrence",
  ],
  IRN_ISR: [
    "proxy conflict",
    "nuclear program",
    "regional strikes and retaliation",
    "UN sanctions history",
    "Lebanon and Syria fronts",
  ],
  IRN_SAU: [
    "Yemen proxy conflict",
    "Gulf rivalry",
    "2016 diplomatic restoration",
    "energy and sanctions",
    "regional coalition politics",
  ],
  SAU_TUR: [
    "Qatar blockade positions",
    "defense cooperation MOUs",
    "OPEC+ coordination",
    "Khashoggi-era diplomacy",
    "regional power balancing",
  ],
  RUS_TUR: [
    "Montreux Convention",
    "Syria policy divergence",
    "S-400 procurement",
    "Black Sea incidents",
    "energy transit",
  ],
};

let cachedCountryModules: ModuleSourceRequirement[] | null = null;
let cachedRelationshipModules: ModuleSourceRequirement[] | null = null;

export async function loadCountryModuleTemplate(): Promise<ModuleSourceRequirement[]> {
  if (cachedCountryModules) return cachedCountryModules;
  const usa = await readJsonFile<CountrySourceRequirementsFile>(
    repoPath("data", "source_requirements", "countries", "USA.source_requirements.v1.json"),
  );
  cachedCountryModules = usa.modules;
  return cachedCountryModules;
}

export async function loadRelationshipModuleTemplate(): Promise<ModuleSourceRequirement[]> {
  if (cachedRelationshipModules) return cachedRelationshipModules;
  const egyEth = await readJsonFile<RelationshipSourceRequirementsFile>(
    repoPath("data", "source_requirements", "relationships", "EGY_ETH.source_requirements.v1.json"),
  );
  cachedRelationshipModules = egyEth.modules;
  return cachedRelationshipModules;
}

export function buildCountryRequirements(countryCode: string): CountrySourceRequirementsFile {
  if (!cachedCountryModules) {
    throw new Error("Call loadCountryModuleTemplate() before buildCountryRequirements().");
  }
  return {
    target_id: countryCode,
    target_type: "country",
    last_updated: new Date().toISOString().slice(0, 10),
    country_topics: COUNTRY_TOPICS[countryCode] ?? [],
    modules: cachedCountryModules.map((module) => ({ ...module })),
  };
}

export function buildRelationshipRequirements(relationshipId: string): RelationshipSourceRequirementsFile {
  if (!cachedRelationshipModules) {
    throw new Error("Call loadRelationshipModuleTemplate() before buildRelationshipRequirements().");
  }
  return {
    target_id: relationshipId,
    target_type: "relationship",
    last_updated: new Date().toISOString().slice(0, 10),
    coverage_topics: RELATIONSHIP_TOPICS[relationshipId] ?? [],
    modules: cachedRelationshipModules.map((module) => ({ ...module })),
  };
}

export const MISSING_COUNTRY_REQUIREMENTS = [
  "CHN",
  "EGY",
  "ETH",
  "RUS",
  "UKR",
  "IND",
  "PAK",
  "ISR",
  "IRN",
  "SAU",
  "TUR",
] as const;

const REQUIRED_MODULE_FIELDS = [
  "module",
  "minimum_sources",
  "required_source_types",
  "required_claim_types",
  "freshness_requirement",
  "minimum_claim_count",
  "minimum_metric_count",
  "required_review_status_level",
  "completion_threshold",
] as const;

export function validateCountryRequirements(file: CountrySourceRequirementsFile): string[] {
  const errors: string[] = [];
  if (file.target_type !== "country") errors.push(`${file.target_id}: target_type must be country`);
  if (!file.target_id) errors.push("country requirements missing target_id");
  if (!Array.isArray(file.modules) || file.modules.length === 0) errors.push(`${file.target_id}: modules must be non-empty`);
  for (const entry of file.modules) {
    for (const field of REQUIRED_MODULE_FIELDS) {
      if ((entry as Record<string, unknown>)[field] === undefined) {
        errors.push(`${file.target_id}/${entry.module}: missing ${field}`);
      }
    }
  }
  return errors;
}

export function validateRelationshipRequirements(file: RelationshipSourceRequirementsFile): string[] {
  const errors: string[] = [];
  if (file.target_type !== "relationship") errors.push(file.target_id + ": target_type must be relationship");
  if (!file.target_id) errors.push("relationship requirements missing target_id");
  if (!Array.isArray(file.modules) || file.modules.length === 0) {
    errors.push(file.target_id + ": modules must be non-empty");
  }
  for (const entry of file.modules) {
    for (const field of REQUIRED_MODULE_FIELDS) {
      if ((entry as Record<string, unknown>)[field] === undefined) {
        errors.push(file.target_id + "/" + entry.module + ": missing " + field);
      }
    }
  }
  if (!Array.isArray(file.coverage_topics) || file.coverage_topics.length === 0) {
    errors.push(file.target_id + ": coverage_topics must be non-empty");
  }
  return errors;
}

export const MISSING_RELATIONSHIP_REQUIREMENTS = [
  "CHN_USA",
  "RUS_UKR",
  "IND_PAK",
  "IRN_ISR",
  "IRN_SAU",
  "SAU_TUR",
  "RUS_TUR",
] as const;
