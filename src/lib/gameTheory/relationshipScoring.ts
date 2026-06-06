import type { RelationshipProfile } from "@/types/relationship";
import type { StrategicRelationship } from "@/types/gameTheory";

type RelationshipScoreSection = Partial<Omit<StrategicRelationship, "countries">>;

function clampScore(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

export function scoreStrategicRelationship(
  profile: RelationshipProfile,
): StrategicRelationship {
  const scores = profile.sections.game_theory_profile as RelationshipScoreSection | undefined;

  return {
    countries: profile.countries,
    alignmentScore: clampScore(scores?.alignmentScore, 50),
    conflictRisk: clampScore(scores?.conflictRisk, 50),
    economicDependency: clampScore(scores?.economicDependency, 50),
    militaryTension: clampScore(scores?.militaryTension, 50),
    ideologicalDistance: clampScore(scores?.ideologicalDistance, 50),
    leverageAsymmetry: clampScore(scores?.leverageAsymmetry, 50),
    escalationRisk: clampScore(scores?.escalationRisk, 50),
    cooperationPotential: clampScore(scores?.cooperationPotential, 50),
  };
}
