import type { IsoAlpha3Code } from "./country";
import type { ConfidenceLevel, RagContext } from "./rag";
import type { StrategicSummary } from "./gameTheory";

export type AskMode = "strategic" | "factual";

export type AskRequest = {
  question: string;
  selectedCountries: IsoAlpha3Code[];
  mode?: AskMode;
};

export type AskResponse = {
  answer: string;
  selectedCountries: IsoAlpha3Code[];
  strategicSummary: StrategicSummary;
  confidence: ConfidenceLevel;
  missingData: string[];
  sourceIds: string[];
  debugContext?: RagContext;
};

export type RagStatusRequest = {
  selectedCountries: IsoAlpha3Code[];
};

export type CountryStatus = {
  code: IsoAlpha3Code;
  name?: string;
  countryProfilePath: string;
  hasCountryRag: boolean;
};

export type RelationshipStatus = {
  relationshipId: string;
  countries: [IsoAlpha3Code, IsoAlpha3Code];
  relationshipProfilePath: string;
  hasRelationshipRag: boolean;
};

export type RagStatusResponse = {
  countries: CountryStatus[];
  relationships: RelationshipStatus[];
};
