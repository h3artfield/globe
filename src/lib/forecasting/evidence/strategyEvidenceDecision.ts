import type {
  ForecastAgentStrategy,
  ReplayForecastConfidence,
  SessionEvidenceAssessment,
} from "@/types/forecasting";

export type StrategyEvidenceDecision = {
  needsSources: boolean;
  canForecast: boolean;
  confidenceCeiling: ReplayForecastConfidence;
  markHighUncertainty: boolean;
  summary: string;
};

export function decideStrategyFromAssessment(
  assessment: SessionEvidenceAssessment,
  strategy: ForecastAgentStrategy,
): StrategyEvidenceDecision {
  const overall = assessment.scores.overall_evidence_score;
  const recommendation = assessment.recommendation;
  const ceiling = assessment.confidence_ceiling;

  if (strategy.strategy_id === "cautious_source_hound") {
    const needsSources =
      recommendation !== "forecast_now" || overall < 0.55 || ceiling === "low";
    return {
      needsSources,
      canForecast: !needsSources,
      confidenceCeiling: ceiling,
      markHighUncertainty: true,
      summary: needsSources
        ? "Cautious strategy withholding forecast until evidence is stronger."
        : "Cautious strategy found sufficient evidence to draft a forecast.",
    };
  }

  if (strategy.strategy_id === "balanced_baseline") {
    const needsSources =
      recommendation === "request_more_sources" || overall < 0.5 || ceiling === "low";
    const canForecast =
      !needsSources &&
      (recommendation === "forecast_now" || recommendation === "human_review");
    return {
      needsSources: needsSources || !canForecast,
      canForecast,
      confidenceCeiling: canForecast ? (ceiling === "high" ? "high" : "medium") : ceiling,
      markHighUncertainty: ceiling !== "high",
      summary: canForecast
        ? "Balanced strategy drafting forecast with medium-or-better evidence."
        : "Balanced strategy requires stronger evidence before forecasting.",
    };
  }

  if (strategy.strategy_id === "aggressive_pattern_matcher") {
    const needsSources = overall < 0.22 && recommendation === "request_more_sources";
    return {
      needsSources,
      canForecast: !needsSources,
      confidenceCeiling: ceiling,
      markHighUncertainty: overall < 0.5 || ceiling === "low" || recommendation !== "forecast_now",
      summary: needsSources
        ? "Aggressive strategy still blocked on extremely weak evidence."
        : "Aggressive strategy forecasting with explicit uncertainty markers.",
    };
  }

  const needsSources =
    overall < strategy.evidence_threshold / 20 ||
    (assessment.missing_sources.length > 0 && strategy.source_gap_sensitivity >= 0.5);
  return {
    needsSources,
    canForecast: !needsSources,
    confidenceCeiling: ceiling,
    markHighUncertainty: ceiling !== "high",
    summary: "Custom strategy applied generic assessment thresholds.",
  };
}
