import type { StrategicActor, StrategicRelationship } from "@/types/gameTheory";

export type PayoffMatrixEntry = {
  actor: string;
  cooperatePayoff: number;
  escalatePayoff: number;
  restraintPayoff: number;
  notes: string[];
};

export function buildPayoffMatrix(
  actors: StrategicActor[],
  relationships: StrategicRelationship[],
): PayoffMatrixEntry[] {
  const averageConflictRisk =
    relationships.length > 0
      ? relationships.reduce((sum, relationship) => sum + relationship.conflictRisk, 0) /
        relationships.length
      : 40;

  return actors.map((actor) => {
    const leverageBonus = Math.min(actor.leveragePoints.length * 5, 20);
    const vulnerabilityPenalty = Math.min(actor.vulnerabilities.length * 5, 20);

    return {
      actor: actor.countryCode,
      cooperatePayoff: Math.round(65 - averageConflictRisk * 0.2),
      escalatePayoff: Math.round(35 + leverageBonus - vulnerabilityPenalty),
      restraintPayoff: Math.round(55 - vulnerabilityPenalty * 0.5),
      notes: [
        `${actor.countryCode} leverage points: ${actor.leveragePoints.join(", ") || "not specified"}`,
        `${actor.countryCode} vulnerabilities: ${actor.vulnerabilities.join(", ") || "not specified"}`,
      ],
    };
  });
}
