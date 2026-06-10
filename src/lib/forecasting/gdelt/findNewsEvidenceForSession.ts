import type { GdeltNewsQuery, NewsEvidenceRecord, ReplaySession } from "@/types/forecasting";
import { GDELT_NEWS_SOURCE_ID } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import { ingestGdeltNews } from "@/lib/forecasting/gdelt/ingestGdeltNews";
import { queryNewsEvidence } from "@/lib/forecasting/gdelt/newsEvidenceStore";

function subtractDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

export function buildGdeltQueryFromSession(session: ReplaySession): GdeltNewsQuery {
  const queryTerms = session.question_text
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 6)
    .join(" ");

  const nowIso = new Date().toISOString();
  let endDate =
    session.resolution_spec.kind === "polymarket_market_outcome" && session.resolution_spec.end_date
      ? session.resolution_spec.end_date
      : `${session.forecast_year}-12-31T23:59:59Z`;
  if (endDate > nowIso) {
    endDate = nowIso;
  }

  const yearStart = `${session.forecast_year}-01-01T00:00:00Z`;
  const rollingStart = subtractDays(endDate, 90);
  const startDate = yearStart < rollingStart ? yearStart : rollingStart;

  const query: GdeltNewsQuery = {
    query: queryTerms,
    start_date: startDate,
    end_date: endDate,
    limit: 20,
    sort: "relevance_score",
  };

  if (session.target.target_type === "country") {
    query.country = session.target.target_id;
  } else if (session.target.target_type === "relationship") {
    query.relationship = session.target.target_id;
  }

  return query;
}

export async function findNewsEvidenceForSession(
  session: ReplaySession,
  queryOverride?: GdeltNewsQuery,
): Promise<NewsEvidenceRecord[]> {
  const query = queryOverride ?? buildGdeltQueryFromSession(session);
  let records = queryNewsEvidence(query);

  if (records.length === 0) {
    await ingestGdeltNews({
      use_mock: true,
      query: query.query,
      country: query.country,
      relationship: query.relationship,
      topic: query.topic,
      start_date: query.start_date,
      end_date: query.end_date,
      limit: query.limit,
    });
    records = queryNewsEvidence(query);
  }

  if (!session.allowed_source_ids.includes(GDELT_NEWS_SOURCE_ID)) {
    return [];
  }

  return records
    .filter((record) => {
      if (session.target.target_type === "country") {
        return record.country_iso3_list.includes(session.target.target_id);
      }
      if (session.target.target_type === "relationship") {
        return record.relationship_pair_list.includes(session.target.target_id);
      }
      return true;
    })
    .slice(0, query.limit ?? 20);
}
