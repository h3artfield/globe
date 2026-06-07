export type EventImportanceInput = {
  fatalities?: number | null;
  economicDamageUsd?: number | null;
  peopleAffected?: number | null;
  leadershipChange?: boolean;
  constitutionalChange?: boolean;
  warInvolvement?: boolean;
  sanctionsImpact?: boolean;
  tradeImpact?: boolean;
  internationalAttention?: number | null;
  longTermPolicyChange?: boolean;
  relationshipImpact?: boolean;
  majorSourceFrequency?: number | null;
  gdeltVolume?: number | null;
  gdeltToneMagnitude?: number | null;
  manualReviewOverride?: number | null;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreEventImportance(input: EventImportanceInput): number {
  if (typeof input.manualReviewOverride === "number") {
    return clampScore(input.manualReviewOverride);
  }

  const fatalitiesScore = Math.min(Math.log10((input.fatalities ?? 0) + 1) * 12, 25);
  const economicScore = Math.min(Math.log10((input.economicDamageUsd ?? 0) + 1) * 3, 20);
  const affectedScore = Math.min(Math.log10((input.peopleAffected ?? 0) + 1) * 4, 18);
  const institutionalScore =
    (input.leadershipChange ? 15 : 0) +
    (input.constitutionalChange ? 18 : 0) +
    (input.longTermPolicyChange ? 12 : 0);
  const conflictScore =
    (input.warInvolvement ? 20 : 0) +
    (input.sanctionsImpact ? 8 : 0) +
    (input.relationshipImpact ? 10 : 0);
  const economicPolicyScore = input.tradeImpact ? 8 : 0;

  // Media volume is capped so news-cycle intensity cannot outrank wars, coups,
  // constitutional changes, currency collapses, elections, or major disasters.
  const mediaScore = Math.min(
    ((input.internationalAttention ?? 0) + (input.majorSourceFrequency ?? 0)) * 0.5 +
      Math.log10((input.gdeltVolume ?? 0) + 1) * 2 +
      Math.abs(input.gdeltToneMagnitude ?? 0),
    12,
  );

  return clampScore(
    fatalitiesScore +
      economicScore +
      affectedScore +
      institutionalScore +
      conflictScore +
      economicPolicyScore +
      mediaScore,
  );
}
