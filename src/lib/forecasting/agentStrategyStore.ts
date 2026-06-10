import path from "node:path";
import type { CreateAgentStrategyRequest, ForecastAgentStrategy } from "@/types/forecasting";
import { pathExists, readJsonFile, writeJsonFile } from "@/lib/pipeline/io";
import { agentRulesPath } from "@/lib/forecasting/forecastAgentStore";
import {
  getBuiltinAgentStrategy,
  listAvailableAgentStrategies,
} from "@/lib/forecasting/builtInAgentStrategies";

function strategyPath(agentId: string): string {
  return path.join(path.dirname(agentRulesPath(agentId)), "strategy.v1.json");
}

export async function loadAgentStrategy(agentId: string): Promise<ForecastAgentStrategy | null> {
  const filePath = strategyPath(agentId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<ForecastAgentStrategy>(filePath);
}

export async function saveAgentStrategy(
  agentId: string,
  strategy: ForecastAgentStrategy,
): Promise<void> {
  await writeJsonFile(strategyPath(agentId), strategy);
}

export async function upsertAgentStrategy(
  agentId: string,
  input: CreateAgentStrategyRequest,
): Promise<ForecastAgentStrategy> {
  const existing = await loadAgentStrategy(agentId);
  const strategy: ForecastAgentStrategy = {
    strategy_id: input.strategy_id?.trim() || existing?.strategy_id || `custom_${agentId}`,
    name: input.name.trim(),
    description: input.description?.trim() ?? existing?.description ?? "",
    agent_id: agentId,
    risk_style: input.risk_style ?? existing?.risk_style ?? "balanced",
    evidence_threshold: input.evidence_threshold ?? existing?.evidence_threshold ?? 6,
    uncertainty_penalty: input.uncertainty_penalty ?? existing?.uncertainty_penalty ?? 0.15,
    source_gap_sensitivity:
      input.source_gap_sensitivity ?? existing?.source_gap_sensitivity ?? 0.5,
    preferred_source_ids:
      input.preferred_source_ids ?? existing?.preferred_source_ids ?? [],
    rule_weights: input.rule_weights ?? existing?.rule_weights ?? {},
    active: input.active ?? existing?.active ?? true,
  };
  await saveAgentStrategy(agentId, strategy);
  return strategy;
}

export async function resolveAgentStrategy(
  agentId: string,
  strategyId: string,
): Promise<ForecastAgentStrategy | null> {
  const builtin = getBuiltinAgentStrategy(strategyId);
  if (builtin) {
    return builtin;
  }
  const saved = await loadAgentStrategy(agentId);
  if (saved && saved.strategy_id === strategyId) {
    return saved;
  }
  return null;
}

export function listAgentStrategyOptions(
  agentId: string,
  savedStrategy: ForecastAgentStrategy | null,
): ForecastAgentStrategy[] {
  return listAvailableAgentStrategies(savedStrategy);
}
