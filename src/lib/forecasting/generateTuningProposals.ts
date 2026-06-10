import type {
  ForecastStrategyTuningProposal,
  ForecastTournament,
  StrategyTuningProposedChanges,
} from "@/types/forecasting";
import { getBuiltinAgentStrategy } from "@/lib/forecasting/builtInAgentStrategies";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import {
  createTuningProposalId,
  saveTuningProposal,
} from "@/lib/forecasting/tuningProposalStore";

function parseGapSource(gap: string): string {
  const match = /^([^(]+)/.exec(gap.trim());
  return match ? match[1]!.trim() : gap;
}

export async function generateTuningProposalsForTournament(
  tournament: ForecastTournament,
): Promise<ForecastStrategyTuningProposal[]> {
  const proposals: ForecastStrategyTuningProposal[] = [];
  const summary = tournament.summary;

  for (let index = 0; index < tournament.agent_ids.length; index += 1) {
    const agentId = tournament.agent_ids[index]!;
    const strategyId =
      tournament.strategy_ids[index] ?? tournament.strategy_ids[0] ?? "balanced_baseline";
    const base = getBuiltinAgentStrategy(strategyId);

    const sessionIdsForAgent: string[] = [];
    for (const sessionId of tournament.session_ids) {
      const session = await loadReplaySession(sessionId);
      if (session?.agent_id === agentId) {
        sessionIdsForAgent.push(sessionId);
      }
    }

    const proposedChanges: StrategyTuningProposedChanges = {};
    const reasons: string[] = [];

    if (summary.needs_sources_sessions > 0) {
      proposedChanges.evidence_threshold = Math.min((base?.evidence_threshold ?? 6) + 2, 20);
      proposedChanges.source_gap_sensitivity = Math.min(
        (base?.source_gap_sensitivity ?? 0.5) + 0.15,
        1,
      );
      reasons.push("Tournament had sessions ending in needs_sources.");
    }

    if (summary.common_source_gaps.length > 0) {
      proposedChanges.preferred_source_ids = summary.common_source_gaps
        .slice(0, 3)
        .map(parseGapSource);
      reasons.push("Repeated source gaps observed across tournament sessions.");
    }

    if (summary.common_judge_warnings.length > 0) {
      proposedChanges.uncertainty_penalty = Math.min(
        (base?.uncertainty_penalty ?? 0.15) + 0.05,
        0.4,
      );
      reasons.push("Judge warnings suggest higher uncertainty penalty.");
    }

    if (reasons.length === 0) {
      reasons.push("Baseline tuning review from tournament summary.");
    }

    const proposal: ForecastStrategyTuningProposal = {
      proposal_id: createTuningProposalId(),
      tournament_id: tournament.tournament_id,
      agent_id: agentId,
      strategy_id: strategyId,
      created_at: new Date().toISOString(),
      proposed_changes: proposedChanges,
      reasons,
      supporting_sessions: sessionIdsForAgent,
      source_gap_patterns: summary.common_source_gaps,
      judge_warning_patterns: summary.common_judge_warnings,
      expected_effect:
        "Reduce premature forecasts on thin evidence and prioritize missing local sources before lock.",
      status: "proposed",
      applied_at: null,
      previous_strategy_version: null,
      new_strategy_version: null,
    };

    await saveTuningProposal(proposal);
    proposals.push(proposal);
  }

  return proposals;
}
