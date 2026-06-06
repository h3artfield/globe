import type { IsoAlpha3Code } from "./country";

export type StrategicActor = {
  countryCode: IsoAlpha3Code;
  leadershipGoals: string[];
  regimeSurvivalNeeds: string[];
  economicNeeds: string[];
  securityNeeds: string[];
  ideologicalGoals: string[];
  domesticConstraints: string[];
  foreignConstraints: string[];
  leveragePoints: string[];
  vulnerabilities: string[];
  redLines: string[];
};

export type StrategicRelationship = {
  countries: [IsoAlpha3Code, IsoAlpha3Code];
  alignmentScore: number;
  conflictRisk: number;
  economicDependency: number;
  militaryTension: number;
  ideologicalDistance: number;
  leverageAsymmetry: number;
  escalationRisk: number;
  cooperationPotential: number;
};

export type StrategicSummary = {
  mainIncentives: string[];
  mainConstraints: string[];
  likelyMoves: string[];
  escalationRisks: string[];
  deescalationOptions: string[];
};
