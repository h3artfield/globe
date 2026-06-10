import type {
  QuestionDomain,
  ReplayEvidenceSnapshot,
  ReplaySession,
  SourceGap,
} from "@/types/forecasting";
import {
  inferQuestionDomain,
  recommendedSourcesForDomain,
} from "@/lib/forecasting/evidence/inferQuestionDomain";

function presentSourceIds(snapshot: ReplayEvidenceSnapshot | null): Set<string> {
  const ids = new Set<string>();
  if (!snapshot) {
    return ids;
  }
  for (const record of snapshot.included_records) {
    ids.add(record.source_id);
  }
  if ((snapshot.news_evidence_records?.length ?? 0) > 0) {
    ids.add("gdelt_news_events");
  }
  return ids;
}

function gapReason(domain: QuestionDomain, sourceId: string): string {
  const labels: Record<string, string> = {
    gdelt_news_events: "news/event coverage",
    ucdp: "conflict event data",
    unodc: "crime statistics",
    un_comtrade_bilateral: "bilateral trade metrics",
    polymarket: "market-implied probability signal",
  };
  const label = labels[sourceId] ?? sourceId;
  return `${domain} questions typically need ${label}.`;
}

export function detectSourceGaps(
  session: ReplaySession,
  snapshot: ReplayEvidenceSnapshot | null,
): SourceGap[] {
  const domain = inferQuestionDomain(session);
  const recommended = recommendedSourcesForDomain(domain).filter((sourceId) =>
    session.allowed_source_ids.includes(sourceId),
  );
  const present = presentSourceIds(snapshot);
  const missingFromSnapshot = snapshot?.missing_sources ?? [];

  const gaps: SourceGap[] = [];
  for (const sourceId of recommended) {
    const hasRecords = present.has(sourceId);
    const listedMissing = missingFromSnapshot.includes(sourceId);
    if (!hasRecords || listedMissing) {
      gaps.push({
        gap_id: `${domain}_${sourceId}`,
        question_domain: domain,
        missing_source_id: sourceId,
        reason: gapReason(domain, sourceId),
        priority:
          sourceId === "gdelt_news_events" || sourceId === "ucdp" || sourceId === "unodc"
            ? "high"
            : "medium",
      });
    }
  }

  for (const sourceId of missingFromSnapshot) {
    if (gaps.some((gap) => gap.missing_source_id === sourceId)) {
      continue;
    }
    if (!session.allowed_source_ids.includes(sourceId)) {
      continue;
    }
    gaps.push({
      gap_id: `${domain}_${sourceId}_snapshot`,
      question_domain: domain,
      missing_source_id: sourceId,
      reason: `Evidence snapshot marked ${sourceId} as missing.`,
      priority: "medium",
    });
  }

  return gaps;
}
