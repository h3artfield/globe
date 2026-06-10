import type { ReplaySession } from "@/types/forecasting";
import { getPolymarketQuestionById } from "@/lib/forecasting/polymarket/questionStore";
import type { ReplaySourceAdapter } from "@/lib/forecasting/replay/sourceAdapters/types";

const SOURCE_ID = "polymarket";

function appliesToSession(session: ReplaySession): boolean {
  return session.resolution_spec.kind === "polymarket_market_outcome";
}

function yesOutcomeFromQuestion(
  question: NonNullable<ReturnType<typeof getPolymarketQuestionById>>,
): boolean | null {
  if (question.resolution_status !== "resolved") {
    return null;
  }
  const winning = question.winning_outcome?.toLowerCase();
  if (winning === "yes") {
    return true;
  }
  if (winning === "no") {
    return false;
  }
  const yesIndex = question.outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes");
  if (yesIndex >= 0 && (question.outcome_prices[yesIndex] ?? 0) >= 0.9) {
    return true;
  }
  const noIndex = question.outcomes.findIndex((outcome) => outcome.toLowerCase() === "no");
  if (noIndex >= 0 && (question.outcome_prices[noIndex] ?? 0) >= 0.9) {
    return false;
  }
  return null;
}

export const polymarketMarketAdapter: ReplaySourceAdapter = {
  source_id: SOURCE_ID,

  canBuildEvidenceSnapshot(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  canResolve(session: ReplaySession): boolean {
    return appliesToSession(session);
  },

  async buildEvidenceSnapshot(session) {
    const question = session.source_market_id
      ? getPolymarketQuestionById(session.source_market_id)
      : null;
    if (!question) {
      return {
        included_records: [],
        missing_reason: SOURCE_ID,
        excluded_future_records_count: 0,
        source_paths: [],
        confidence: "low",
        limitations: ["Polymarket question metadata not found in local index."],
      };
    }

    return {
      included_records: [
        {
          record_id: question.source_market_id,
          source_id: SOURCE_ID,
          label: question.title,
          year: question.end_date ? new Date(question.end_date).getUTCFullYear() : null,
          date: question.end_date,
          value_summary: `implied=${question.implied_probability ?? "n/a"}; status=${question.resolution_status}`,
        },
      ],
      missing_reason: null,
      excluded_future_records_count: 0,
      source_paths: [question.raw_record_path],
      confidence: question.resolution_status === "open" ? "medium" : "high",
      limitations: ["Polymarket market metadata snapshot; not a trade feed."],
    };
  },

  async resolve(session) {
    const question = session.source_market_id
      ? getPolymarketQuestionById(session.source_market_id)
      : null;
    if (!question) {
      return {
        outcome: "missing_evidence",
        resolved_value: null,
        prior_value: null,
        comparison_value: null,
        source_records: [],
        source_paths: [],
        confidence: "low",
        limitations: ["Polymarket question metadata not found in local index."],
      };
    }

    const yesOutcome = yesOutcomeFromQuestion(question);
    if (yesOutcome === null) {
      return {
        outcome: "missing_evidence",
        resolved_value: null,
        prior_value: null,
        comparison_value: null,
        source_records: [],
        source_paths: [question.raw_record_path],
        confidence: "low",
        limitations: ["Polymarket market is not resolved yet."],
      };
    }

    return {
      outcome: yesOutcome ? "yes" : "no",
      resolved_value: yesOutcome,
      prior_value: question.implied_probability,
      comparison_value: yesOutcome,
      source_records: [
        {
          record_id: question.source_market_id,
          source_id: SOURCE_ID,
          label: question.title,
          year: question.end_date ? new Date(question.end_date).getUTCFullYear() : null,
          date: question.end_date,
          value_summary: `winning_outcome=${question.winning_outcome}; prices=${question.outcome_prices.join(",")}`,
        },
      ],
      source_paths: [question.raw_record_path],
      confidence: "high",
      limitations: [],
    };
  },
};
