import type { StrategicSummary } from "@/types/gameTheory";
import type { RagContext } from "@/types/rag";
import { buildStrategicActor } from "./actorModel";
import { buildPayoffMatrix } from "./payoffMatrix";
import { scoreStrategicRelationship } from "./relationshipScoring";
import { buildScenarioOutline } from "./scenarioBuilder";

export type StrategicAnalysisResult = {
  answer: string;
  strategicSummary: StrategicSummary;
};

function firstItems(values: string[], fallback: string): string[] {
  return values.length > 0 ? values.slice(0, 5) : [fallback];
}

export function buildStrategicAnalysis(
  question: string,
  ragContext: RagContext,
): StrategicAnalysisResult {
  const loadedCountryProfiles = ragContext.countryProfiles.filter((profile) => profile.exists);
  const loadedRelationshipProfiles = ragContext.relationshipProfiles.filter(
    (profile) => profile.exists,
  );
  const actors = loadedCountryProfiles.map((profile) => buildStrategicActor(profile.data));
  const relationships = loadedRelationshipProfiles.map((profile) =>
    scoreStrategicRelationship(profile.data),
  );
  const payoffMatrix = buildPayoffMatrix(actors, relationships);
  const scenario = buildScenarioOutline(question, ragContext);

  const actorGoals = actors.flatMap((actor) =>
    actor.leadershipGoals.map((goal) => `${actor.countryCode}: ${goal}`),
  );
  const actorConstraints = actors.flatMap((actor) => [
    ...actor.domesticConstraints.map((constraint) => `${actor.countryCode}: ${constraint}`),
    ...actor.foreignConstraints.map((constraint) => `${actor.countryCode}: ${constraint}`),
    ...actor.vulnerabilities.map((vulnerability) => `${actor.countryCode}: ${vulnerability}`),
  ]);
  const likelyMoves = payoffMatrix.map(
    (entry) =>
      `${entry.actor}: compare cooperation payoff ${entry.cooperatePayoff}, restraint payoff ${entry.restraintPayoff}, escalation payoff ${entry.escalatePayoff}.`,
  );
  const escalationRisks = relationships.map(
    (relationship) =>
      `${relationship.countries.join("_")}: conflict risk ${relationship.conflictRisk}/100, escalation risk ${relationship.escalationRisk}/100.`,
  );
  const deescalationOptions = relationships.map(
    (relationship) =>
      `${relationship.countries.join("_")}: cooperation potential ${relationship.cooperationPotential}/100 suggests room for negotiated mechanisms if credible guarantees exist.`,
  );

  const strategicSummary: StrategicSummary = {
    mainIncentives: firstItems(actorGoals, "No detailed leadership goals were loaded."),
    mainConstraints: firstItems(actorConstraints, "No detailed constraints were loaded."),
    likelyMoves: firstItems(likelyMoves, "Likely moves require more country and relationship data."),
    escalationRisks: firstItems(escalationRisks, "Escalation risk requires relationship data."),
    deescalationOptions: firstItems(
      deescalationOptions,
      "Deescalation options require relationship data.",
    ),
  };

  const loadedCountrySectionNames = loadedCountryProfiles.flatMap((profile) =>
    Object.keys(profile.data.sections).map((section) => `${profile.countryCode}.${section}`),
  );
  const loadedRelationshipSectionNames = loadedRelationshipProfiles.flatMap((profile) =>
    Object.keys(profile.data.sections).map((section) => `${profile.relationshipId}.${section}`),
  );

  const answer = [
    `Question: ${question}`,
    "",
    `Selected scope: ${scenario.countries.join(", ") || "none"}.`,
    `Loaded country profiles: ${scenario.loadedCountryProfiles.join(", ") || "none"}.`,
    `Loaded relationship profiles: ${scenario.loadedRelationshipProfiles.join(", ") || "none"}.`,
    "",
    "Facts available from local RAG stubs:",
    `Country sections: ${loadedCountrySectionNames.join(", ") || "none"}.`,
    `Relationship sections: ${loadedRelationshipSectionNames.join(", ") || "none"}.`,
    "",
    "Strategic inference from loaded profiles:",
    `Main incentives: ${strategicSummary.mainIncentives.join(" | ")}`,
    `Main constraints: ${strategicSummary.mainConstraints.join(" | ")}`,
    `Likely moves: ${strategicSummary.likelyMoves.join(" | ")}`,
    `Escalation risks: ${strategicSummary.escalationRisks.join(" | ")}`,
    `Deescalation options: ${strategicSummary.deescalationOptions.join(" | ")}`,
    "",
    `Missing data: ${ragContext.missingData.length > 0 ? ragContext.missingData.join(" | ") : "none"}.`,
    `Planned context size: ${JSON.stringify(ragContext.plannedContextSize)}.`,
  ].join("\n");

  return {
    answer,
    strategicSummary,
  };
}
