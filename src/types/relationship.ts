import type { IsoAlpha3Code } from "./country";
import type { RagConfidence, RagSectionMap } from "./rag";

export type RelationshipId = `${string}_${string}`;

export type RelationshipProfile = {
  relationship_id: RelationshipId;
  countries: [IsoAlpha3Code, IsoAlpha3Code];
  version: string;
  last_updated: string;
  sections: RagSectionMap;
  source_notes: string[];
  confidence: RagConfidence;
};
