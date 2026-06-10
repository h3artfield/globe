import type { ForecastAgentStrategy } from "@/types/forecasting";

export const BUILTIN_AGENT_STRATEGIES: ForecastAgentStrategy[] = [
  {
    strategy_id: "cautious_source_hound",
    name: "Cautious Source Hound",
    description:
      "Requests additional local sources when evidence is thin or missing before drafting a forecast.",
    agent_id: null,
    version: 1,
    risk_style: "cautious",
    evidence_threshold: 12,
    uncertainty_penalty: 0.25,
    source_gap_sensitivity: 0.9,
    preferred_source_ids: [],
    rule_weights: { missing_sources: 1.5, low_record_count: 1.2 },
    active: true,
  },
  {
    strategy_id: "balanced_baseline",
    name: "Balanced Baseline",
    description:
      "Drafts a forecast when medium-confidence evidence exists; requests sources only on major gaps.",
    agent_id: null,
    version: 1,
    risk_style: "balanced",
    evidence_threshold: 6,
    uncertainty_penalty: 0.15,
    source_gap_sensitivity: 0.5,
    preferred_source_ids: [],
    rule_weights: { missing_sources: 1.0, low_record_count: 0.8 },
    active: true,
  },
  {
    strategy_id: "aggressive_pattern_matcher",
    name: "Aggressive Pattern Matcher",
    description:
      "Forecasts from weaker evidence patterns but marks higher uncertainty and wider probability moves.",
    agent_id: null,
    version: 1,
    risk_style: "aggressive",
    evidence_threshold: 2,
    uncertainty_penalty: 0.08,
    source_gap_sensitivity: 0.2,
    preferred_source_ids: [],
    rule_weights: { missing_sources: 0.5, low_record_count: 0.4 },
    active: true,
  },
];

export function getBuiltinAgentStrategy(strategyId: string): ForecastAgentStrategy | null {
  return BUILTIN_AGENT_STRATEGIES.find((strategy) => strategy.strategy_id === strategyId) ?? null;
}

export function listAvailableAgentStrategies(
  savedStrategy: ForecastAgentStrategy | null,
): ForecastAgentStrategy[] {
  const builtins = BUILTIN_AGENT_STRATEGIES.filter((strategy) => strategy.active);
  if (savedStrategy && savedStrategy.active) {
    const exists = builtins.some((strategy) => strategy.strategy_id === savedStrategy.strategy_id);
    return exists ? builtins : [...builtins, savedStrategy];
  }
  return builtins;
}
