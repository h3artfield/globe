import type { CreateReplaySessionRequest, ReplayComparisonGroup } from "@/types/forecasting";
import { loadForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { loadReplayTemplate } from "@/lib/forecasting/loadReplayTemplates";
import {
  createComparisonGroupId,
  saveComparisonGroup,
} from "@/lib/forecasting/replayComparisonStore";
import { createReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export type CreateComparisonRequest = {
  template_id: string;
  target: string;
  year: number;
  agent_ids: string[];
};

export async function createComparisonReplay(
  input: CreateComparisonRequest,
): Promise<ReplayComparisonGroup> {
  if (!input.agent_ids || input.agent_ids.length < 2) {
    throw new ReplaySessionValidationError("At least two agent_ids are required for comparison");
  }

  const template = await loadReplayTemplate(input.template_id);
  if (!template) {
    throw new ReplaySessionValidationError(`Unknown template_id: ${input.template_id}`);
  }

  const uniqueAgentIds = [...new Set(input.agent_ids.map((id) => id.trim()))];
  for (const agentId of uniqueAgentIds) {
    const agent = await loadForecastAgent(agentId);
    if (!agent) {
      throw new ReplaySessionValidationError(`Agent not found: ${agentId}`);
    }
  }

  const sessionIds: string[] = [];
  const baseInput: CreateReplaySessionRequest = {
    template_id: input.template_id,
    target: input.target,
    year: input.year,
  };

  for (const agentId of uniqueAgentIds) {
    const session = await createReplaySession({ ...baseInput, agent_id: agentId });
    sessionIds.push(session.session_id);
  }

  const group: ReplayComparisonGroup = {
    comparison_group_id: createComparisonGroupId(),
    template_id: input.template_id,
    target: {
      target_type: template.target_type,
      target_id: input.target.trim().toUpperCase(),
    },
    forecast_year: input.year,
    resolution_year: template.resolution_year,
    session_ids: sessionIds,
    agent_ids: uniqueAgentIds,
    created_at: new Date().toISOString(),
  };

  await saveComparisonGroup(group);
  return group;
}
