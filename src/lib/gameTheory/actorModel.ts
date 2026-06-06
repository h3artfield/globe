import type { StrategicActor } from "@/types/gameTheory";
import type { CountryProfile } from "@/types/rag";

type GameTheoryProfileSection = {
  leadership_goals?: string[];
  regime_survival_needs?: string[];
  economic_needs?: string[];
  security_needs?: string[];
  ideological_goals?: string[];
  domestic_constraints?: string[];
  foreign_constraints?: string[];
  leverage_points?: string[];
  vulnerabilities?: string[];
  red_lines?: string[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function buildStrategicActor(profile: CountryProfile): StrategicActor {
  const gameTheoryProfile = profile.sections.game_theory_profile as
    | GameTheoryProfileSection
    | undefined;

  return {
    countryCode: profile.country_code,
    leadershipGoals: asStringArray(gameTheoryProfile?.leadership_goals),
    regimeSurvivalNeeds: asStringArray(gameTheoryProfile?.regime_survival_needs),
    economicNeeds: asStringArray(gameTheoryProfile?.economic_needs),
    securityNeeds: asStringArray(gameTheoryProfile?.security_needs),
    ideologicalGoals: asStringArray(gameTheoryProfile?.ideological_goals),
    domesticConstraints: asStringArray(gameTheoryProfile?.domestic_constraints),
    foreignConstraints: asStringArray(gameTheoryProfile?.foreign_constraints),
    leveragePoints: asStringArray(gameTheoryProfile?.leverage_points),
    vulnerabilities: asStringArray(gameTheoryProfile?.vulnerabilities),
    redLines: asStringArray(gameTheoryProfile?.red_lines),
  };
}
