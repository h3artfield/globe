import type { IsoAlpha3Code } from "./country";
import type { RelationshipProfile } from "./relationship";

export type ConfidenceLevel = "low" | "medium" | "high" | "unknown";

export type RagSectionMap = Record<string, unknown>;

export type RagConfidence = {
  overall: ConfidenceLevel;
  weak_sections: string[];
};

export type CountryProfile = {
  country_code: IsoAlpha3Code;
  country_name: string;
  version: string;
  last_updated: string;
  sections: RagSectionMap;
  source_notes: string[];
  confidence: RagConfidence;
};

export type CountryChunk = {
  id: string;
  country_code: IsoAlpha3Code;
  section: string;
  text: string;
  tags: string[];
  source_ids: string[];
};

export type RagLoadResult<T> =
  | {
      exists: true;
      path: string;
      data: T;
      error?: never;
    }
  | {
      exists: false;
      path: string;
      data?: never;
      error?: string;
    };

export type LoadedCountryRag = RagLoadResult<CountryProfile> & {
  countryCode: IsoAlpha3Code;
};

export type LoadedRelationshipRag = RagLoadResult<RelationshipProfile> & {
  relationshipId: string;
  countries: [IsoAlpha3Code, IsoAlpha3Code];
};

export type RagContext = {
  selectedCountries: IsoAlpha3Code[];
  countryProfiles: LoadedCountryRag[];
  relationshipProfiles: LoadedRelationshipRag[];
  missingData: string[];
  plannedContextSize: {
    countryProfilesLoaded: number;
    relationshipProfilesLoaded: number;
    countrySectionCount: number;
    relationshipSectionCount: number;
  };
};
