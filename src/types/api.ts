import type { IsoAlpha3Code } from "./country";
import type { ConfidenceLevel, RagContext } from "./rag";
import type { StrategicSummary } from "./gameTheory";
import type { Citation, RetrievalDebugInfo } from "./vector";

export type AskMode = "overview" | "strategic" | "compare" | "timeline" | "source_audit" | "factual";

export type AskRequest = {
  question: string;
  selectedCountries: IsoAlpha3Code[];
  mode?: AskMode;
  debug?: boolean;
};

export type AskResponse = {
  answer: string;
  selectedCountries: IsoAlpha3Code[];
  strategicSummary: StrategicSummary;
  confidence: ConfidenceLevel;
  missingData: string[];
  sourceIds: string[];
  citations?: Citation[];
  modules_used?: string[];
  chunks_used?: Array<{
    chunk_id: string;
    module: string;
    country_code: string | null;
    relationship_id: string | null;
    source_ids: string[];
    confidence: string;
  }>;
  metrics_used?: Array<{
    metric_id: string;
    country_code: string;
    year: number | null;
    source_id: string | null;
    source_name: string | null;
    unit: string | null;
  }>;
  events_used?: Array<{
    event_id: string;
    event_date: string;
    event_type: string;
    country_codes: string[];
    relationship_id: string | null;
    importance_score: number | null;
    source_ids: string[];
    confidence: string;
  }>;
  retrieval_debug?: RetrievalDebugInfo;
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
