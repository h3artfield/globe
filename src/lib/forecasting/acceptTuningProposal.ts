import type {
  ForecastAgentStrategy,
  ForecastStrategyTuningProposal,
} from "@/types/forecasting";
import {
  createStrategyVersion,
  loadAgentStrategy,
  resolveAgentStrategy,
} from "@/lib/forecasting/agentStrategyStore";
import { applyProposedChangesToStrategy } from "@/lib/forecasting/strategyTuningUtils";
import { loadTuningProposal, saveTuningProposal } from "@/lib/forecasting/tuningProposalStore";

export { applyProposedChangesToStrategy } from "@/lib/forecasting/strategyTuningUtils";

export async function acceptTuningProposal(
  agentId: string,
  proposalId: string,
): Promise<ForecastStrategyTuningProposal> {
  const proposal = await loadTuningProposal(agentId, proposalId);
  if (!proposal) {
    throw new Error(`Tuning proposal not found: ${proposalId}`);
  }
  if (proposal.status !== "proposed") {
    throw new Error(`Proposal ${proposalId} is already ${proposal.status}`);
  }

  const current = await loadAgentStrategy(agentId);
  const base =
    current ??
    (await resolveAgentStrategy(agentId, proposal.strategy_id)) ??
    (() => {
      throw new Error(`Strategy not found for agent ${agentId}`);
    })();

  const previousVersion = current?.version ?? base.version ?? 1;
  const nextStrategy = applyProposedChangesToStrategy(base, proposal.proposed_changes);
  const versioned = await createStrategyVersion(agentId, nextStrategy);

  proposal.status = "accepted";
  proposal.applied_at = new Date().toISOString();
  proposal.previous_strategy_version = previousVersion;
  proposal.new_strategy_version = versioned.version;
  await saveTuningProposal(proposal);
  return proposal;
}

export async function rejectTuningProposal(
  agentId: string,
  proposalId: string,
): Promise<ForecastStrategyTuningProposal> {
  const proposal = await loadTuningProposal(agentId, proposalId);
  if (!proposal) {
    throw new Error(`Tuning proposal not found: ${proposalId}`);
  }
  if (proposal.status !== "proposed") {
    throw new Error(`Proposal ${proposalId} is already ${proposal.status}`);
  }
  proposal.status = "rejected";
  proposal.applied_at = new Date().toISOString();
  await saveTuningProposal(proposal);
  return proposal;
}
