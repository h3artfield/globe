import type { ForecastTournament, TournamentSummary } from "@/types/forecasting";
import { getBuiltinAgentStrategy } from "@/lib/forecasting/builtInAgentStrategies";

export function suggestStrategyTuning(summary: TournamentSummary): string[] {
  const suggestions: string[] = [];

  if (summary.needs_sources_sessions > summary.completed_sessions / 2) {
    suggestions.push(
      "Raise evidence threshold or increase source_gap_sensitivity — many sessions ended in needs_sources.",
    );
  }

  if (summary.common_source_gaps.length > 0) {
    suggestions.push(
      `Request more source types before locking: top gaps were ${summary.common_source_gaps.slice(0, 3).join(", ")}.`,
    );
  }

  if (summary.worst_performing_strategy) {
    const worst = getBuiltinAgentStrategy(summary.worst_performing_strategy);
    if (worst?.risk_style === "aggressive") {
      suggestions.push(
        "Lower confidence when missing baseline data for aggressive_pattern_matcher sessions.",
      );
    }
    if (worst?.risk_style === "cautious") {
      suggestions.push(
        "Consider slightly lowering cautious evidence_threshold if tournaments stall on source requests.",
      );
    }
  }

  if (summary.common_judge_warnings.some((warning) => warning.toLowerCase().includes("leakage"))) {
    suggestions.push("Increase cutoff enforcement review — judge flagged leakage warnings.");
  }

  if (suggestions.length === 0) {
    suggestions.push("No automatic strategy tuning suggested; review per-template Brier breakdown manually.");
  }

  return suggestions;
}

export function buildRecommendedStrategyChanges(
  tournament: ForecastTournament,
  summary: TournamentSummary,
): string[] {
  const changes: string[] = [];
  if (summary.best_performing_strategy && summary.worst_performing_strategy) {
    changes.push(
      `Prefer ${summary.best_performing_strategy} over ${summary.worst_performing_strategy} for similar templates in this tournament.`,
    );
  }
  for (const suggestion of suggestStrategyTuning(summary)) {
    changes.push(`Consider: ${suggestion}`);
  }
  if (tournament.run_config.allow_auto_lock) {
    changes.push("Auto-lock was enabled; verify source fulfillment policy before future auto-lock runs.");
  }
  return changes;
}
