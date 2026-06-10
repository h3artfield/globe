import type {
  ForecastAgentStrategy,
  StrategyTuningProposedChanges,
} from "@/types/forecasting";

export function applyProposedChangesToStrategy(
  base: ForecastAgentStrategy,
  changes: StrategyTuningProposedChanges,
): ForecastAgentStrategy {
  return {
    ...base,
    evidence_threshold: changes.evidence_threshold ?? base.evidence_threshold,
    source_gap_sensitivity: changes.source_gap_sensitivity ?? base.source_gap_sensitivity,
    uncertainty_penalty: changes.uncertainty_penalty ?? base.uncertainty_penalty,
    preferred_source_ids: changes.preferred_source_ids ?? base.preferred_source_ids,
    risk_style: changes.risk_style ?? base.risk_style,
  };
}
