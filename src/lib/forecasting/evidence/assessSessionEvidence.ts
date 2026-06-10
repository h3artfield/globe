import type {
  ReplayEvidenceSnapshot,
  ReplayForecastConfidence,
  ReplaySession,
  SessionEvidenceAssessment,
  SessionEvidenceAssessmentScores,
} from "@/types/forecasting";
import { detectSourceGaps } from "@/lib/forecasting/evidence/detectSourceGaps";
import {
  createEvidenceAssessmentId,
  saveSessionEvidenceAssessment,
} from "@/lib/forecasting/evidence/evidenceAssessmentStore";
import { inferQuestionDomain } from "@/lib/forecasting/evidence/inferQuestionDomain";
import { getPolymarketQuestionById } from "@/lib/forecasting/polymarket/questionStore";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreRelevance(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): number {
  const news = snapshot?.news_evidence_records ?? [];
  if (news.length > 0) {
    return clamp01(avg(news.map((record) => record.relevance_score)));
  }
  const recordCount = snapshot?.included_records.length ?? 0;
  if (recordCount === 0) {
    return 0;
  }
  const haystack = session.question_text.toLowerCase();
  const matched = (snapshot?.included_records ?? []).filter((record) =>
    haystack.split(/\s+/).some((token) => token.length > 4 && record.label.toLowerCase().includes(token)),
  ).length;
  return clamp01(matched / Math.max(recordCount, 1) + 0.35);
}

function scoreRecency(session: ReplaySession, snapshot: ReplayEvidenceSnapshot | null): number {
  const news = snapshot?.news_evidence_records ?? [];
  if (news.length === 0) {
    const years = (snapshot?.included_records ?? [])
      .map((record) => record.year)
      .filter((year): year is number => year !== null);
    if (years.length === 0) {
      return 0.2;
    }
    const latest = Math.max(...years);
    const delta = session.forecast_year - latest;
    return clamp01(1 - delta / 10);
  }
  const cutoff = new Date(`${session.forecast_year}-12-31T23:59:59Z`).getTime();
  const scores = news.map((record) => {
    const published = new Date(record.published_at).getTime();
    const ageDays = Math.max(0, (cutoff - published) / (1000 * 60 * 60 * 24));
    return clamp01(1 - ageDays / 730);
  });
  return clamp01(avg(scores));
}

function scoreSourceDiversity(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): number {
  const present = new Set((snapshot?.included_records ?? []).map((record) => record.source_id));
  if ((snapshot?.news_evidence_records?.length ?? 0) > 0) {
    present.add("gdelt_news_events");
  }
  const allowed = session.allowed_source_ids.length;
  if (allowed === 0) {
    return 0;
  }
  return clamp01(present.size / allowed);
}

function scoreSourceQuality(snapshot: ReplayEvidenceSnapshot | null): number {
  const news = snapshot?.news_evidence_records ?? [];
  if (news.length > 0) {
    return clamp01(avg(news.map((record) => record.source_quality_score)));
  }
  const recordCount = snapshot?.included_records.length ?? 0;
  return recordCount > 0 ? 0.55 : 0;
}

function scoreMetricCoverage(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): number {
  if (session.resolution_spec.kind !== "metric_compare_years") {
    const hasEventRecords = (snapshot?.included_records.length ?? 0) > 0;
    return hasEventRecords ? 0.65 : 0.15;
  }
  const metricId = session.resolution_spec.metric_id;
  const rows = (snapshot?.included_records ?? []).filter((record) =>
    record.label.includes(metricId),
  );
  const expectedSpan = Math.max(1, session.resolution_year - session.forecast_year + 3);
  return clamp01(rows.length / expectedSpan);
}

function scoreNewsCoverage(snapshot: ReplayEvidenceSnapshot | null): number {
  const count = snapshot?.news_evidence_records?.length ?? 0;
  return clamp01(count / 5);
}

function scoreMarketSignal(session: ReplaySession): number {
  if (session.external_source !== "polymarket" || !session.source_market_id) {
    return 0.2;
  }
  const question = getPolymarketQuestionById(session.source_market_id);
  if (!question) {
    return 0.25;
  }
  if (question.implied_probability === null) {
    return 0.35;
  }
  const distanceFromUncertainty = Math.abs(question.implied_probability - 50) / 50;
  const volumeBoost =
    question.volume && question.volume > 1000 ? 0.15 : question.volume && question.volume > 100 ? 0.08 : 0;
  return clamp01(0.45 + distanceFromUncertainty * 0.4 + volumeBoost);
}

function buildSourceMix(snapshot: ReplayEvidenceSnapshot | null): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const record of snapshot?.included_records ?? []) {
    mix[record.source_id] = (mix[record.source_id] ?? 0) + 1;
  }
  const newsCount = snapshot?.news_evidence_records?.length ?? 0;
  if (newsCount > 0) {
    mix.gdelt_news_events = (mix.gdelt_news_events ?? 0) + newsCount;
  }
  return mix;
}

function deriveConfidenceCeiling(
  overall: number,
  highPriorityGaps: number,
): ReplayForecastConfidence {
  if (overall >= 0.72 && highPriorityGaps === 0) {
    return "high";
  }
  if (overall >= 0.48 && highPriorityGaps <= 1) {
    return "medium";
  }
  return "low";
}

function deriveRecommendation(
  overall: number,
  highPriorityGaps: number,
  gapCount: number,
): SessionEvidenceAssessment["recommendation"] {
  if (overall < 0.38 || highPriorityGaps >= 2) {
    return "request_more_sources";
  }
  if (overall >= 0.6 && highPriorityGaps === 0 && gapCount <= 1) {
    return "forecast_now";
  }
  if (overall < 0.5 || highPriorityGaps >= 1) {
    return "request_more_sources";
  }
  return "human_review";
}

function buildWarnings(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
  scores: SessionEvidenceAssessmentScores,
  gaps: SessionEvidenceAssessment["source_gaps"],
): string[] {
  const warnings: string[] = [];
  if (snapshot?.limitations) {
    warnings.push(snapshot.limitations.slice(0, 240));
  }
  if ((snapshot?.included_records.length ?? 0) === 0 && (snapshot?.news_evidence_records?.length ?? 0) === 0) {
    warnings.push("No local evidence records or news articles attached to the snapshot.");
  }
  if (scores.source_diversity < 0.35) {
    warnings.push("Source mix is narrow relative to allowed sources.");
  }
  if (gaps.some((gap) => gap.priority === "high")) {
    warnings.push("High-priority source gaps detected for this question domain.");
  }
  if (session.resolution_spec.kind === "metric_compare_years" && scores.metric_coverage < 0.4) {
    warnings.push(
      `Metric coverage for ${session.resolution_spec.metric_id} is sparse before ${session.forecast_year}.`,
    );
  }
  return warnings;
}

export function assessSessionEvidenceFromInputs(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): SessionEvidenceAssessment {
  const domain = inferQuestionDomain(session);
  const sourceGaps = detectSourceGaps(session, snapshot);
  const highPriorityGaps = sourceGaps.filter((gap) => gap.priority === "high").length;

  const scores: SessionEvidenceAssessmentScores = {
    relevance: scoreRelevance(session, snapshot),
    recency: scoreRecency(session, snapshot),
    source_diversity: scoreSourceDiversity(session, snapshot),
    source_quality: scoreSourceQuality(snapshot),
    metric_coverage: scoreMetricCoverage(session, snapshot),
    news_coverage: scoreNewsCoverage(snapshot),
    market_signal_strength: scoreMarketSignal(session),
    overall_evidence_score: 0,
  };

  scores.overall_evidence_score = clamp01(
    scores.relevance * 0.15 +
      scores.recency * 0.1 +
      scores.source_diversity * 0.15 +
      scores.source_quality * 0.15 +
      scores.metric_coverage * 0.15 +
      scores.news_coverage * 0.15 +
      scores.market_signal_strength * 0.15,
  );

  const missingSources = [
    ...new Set([
      ...(snapshot?.missing_sources ?? []),
      ...sourceGaps.map((gap) => gap.missing_source_id),
    ]),
  ].filter((sourceId) => session.allowed_source_ids.includes(sourceId));

  return {
    assessment_id: createEvidenceAssessmentId(),
    session_id: session.session_id,
    created_at: new Date().toISOString(),
    question_domain: domain,
    scores,
    confidence_ceiling: deriveConfidenceCeiling(scores.overall_evidence_score, highPriorityGaps),
    recommendation: deriveRecommendation(
      scores.overall_evidence_score,
      highPriorityGaps,
      sourceGaps.length,
    ),
    source_mix: buildSourceMix(snapshot),
    missing_sources: missingSources,
    source_gaps: sourceGaps,
    warnings: buildWarnings(session, snapshot, scores, sourceGaps),
  };
}

export async function assessAndSaveSessionEvidence(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): Promise<SessionEvidenceAssessment> {
  const assessment = assessSessionEvidenceFromInputs(session, snapshot);
  await saveSessionEvidenceAssessment(assessment);
  return assessment;
}
