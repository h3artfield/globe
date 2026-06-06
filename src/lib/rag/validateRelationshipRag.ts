import type { RelationshipProfile } from "@/types/relationship";

const RELATIONSHIP_ID_PATTERN = /^[A-Z]{3}_[A-Z]{3}$/;

export function validateRelationshipRag(value: unknown): value is RelationshipProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const relationship = value as Partial<RelationshipProfile>;

  return (
    typeof relationship.relationship_id === "string" &&
    RELATIONSHIP_ID_PATTERN.test(relationship.relationship_id) &&
    Array.isArray(relationship.countries) &&
    relationship.countries.length === 2 &&
    relationship.countries.every((country) => /^[A-Z]{3}$/.test(country)) &&
    typeof relationship.version === "string" &&
    typeof relationship.last_updated === "string" &&
    !!relationship.sections &&
    typeof relationship.sections === "object" &&
    Array.isArray(relationship.source_notes) &&
    !!relationship.confidence &&
    typeof relationship.confidence === "object" &&
    typeof relationship.confidence.overall === "string" &&
    Array.isArray(relationship.confidence.weak_sections)
  );
}
