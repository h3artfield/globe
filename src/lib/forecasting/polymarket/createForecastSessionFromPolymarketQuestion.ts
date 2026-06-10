import type {
  CreateForecastSessionFromPolymarketRequest,
  ForecastQuestionSourceMarket,
  ReplaySession,
  ResolutionSpec,
} from "@/types/forecasting";
import { loadForecastAgent } from "@/lib/forecasting/forecastAgentStore";
import { POLYMARKET_TEMPLATE_ID } from "@/lib/forecasting/polymarket/polymarketConfig";
import { getPolymarketQuestionById } from "@/lib/forecasting/polymarket/questionStore";
import { createSessionId, saveReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function buildResolutionSpec(question: ForecastQuestionSourceMarket): ResolutionSpec {
  return {
    kind: "polymarket_market_outcome",
    source: "polymarket",
    market_id: question.market_id,
    condition_id: question.condition_id,
    resolution_source: question.resolution_source || question.source_url,
    end_date: question.end_date,
  };
}

function inferTarget(question: ForecastQuestionSourceMarket): ReplaySession["target"] {
  if (question.related_relationship_pair_list[0]) {
    return { target_type: "relationship", target_id: question.related_relationship_pair_list[0] };
  }
  if (question.related_country_iso3_list[0]) {
    return { target_type: "country", target_id: question.related_country_iso3_list[0] };
  }
  return { target_type: "country", target_id: "USA" };
}

function inferForecastYear(question: ForecastQuestionSourceMarket): number {
  if (question.end_date) {
    const year = new Date(question.end_date).getUTCFullYear();
    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      return year - 1;
    }
  }
  return new Date().getUTCFullYear();
}

function inferResolutionYear(question: ForecastQuestionSourceMarket, forecastYear: number): number {
  if (question.end_date) {
    const year = new Date(question.end_date).getUTCFullYear();
    if (Number.isInteger(year) && year > forecastYear) {
      return year;
    }
  }
  return forecastYear + 1;
}

export async function createForecastSessionFromPolymarketQuestion(
  input: CreateForecastSessionFromPolymarketRequest,
): Promise<ReplaySession> {
  const sourceMarketId = input.source_market_id.trim();
  const question = getPolymarketQuestionById(sourceMarketId);
  if (!question) {
    throw new ReplaySessionValidationError(
      `Polymarket question not found: ${sourceMarketId}. Run ingest first.`,
    );
  }

  let agentId: string | null = input.agent_id?.trim() ?? null;
  let agentName: string | null = null;
  let agentType: ReplaySession["agent_type"] = null;
  if (agentId) {
    const agent = await loadForecastAgent(agentId);
    if (!agent) {
      throw new ReplaySessionValidationError(`Agent not found: ${agentId}`);
    }
    agentName = agent.name;
    agentType = agent.type;
  }

  const createdAt = new Date().toISOString();
  const forecastYear = inferForecastYear(question);
  const resolutionYear = inferResolutionYear(question, forecastYear);
  const target = inferTarget(question);

  const session: ReplaySession = {
    session_id: createSessionId(),
    template_id: POLYMARKET_TEMPLATE_ID,
    created_at: createdAt,
    locked_at: null,
    target,
    forecast_year: forecastYear,
    resolution_year: resolutionYear,
    question_text: question.question_text,
    resolution_spec: buildResolutionSpec(question),
    allowed_source_ids: ["polymarket", "gdelt_news_events", "un_comtrade_bilateral"],
    status: "draft",
    user_forecast: {
      probability: null,
      confidence: null,
      rationale: "",
    },
    agent_id: agentId,
    agent_name: agentName,
    agent_type: agentType,
    forecast_rationale: "",
    key_signals: [],
    assumptions: [],
    uncertainty_notes: "",
    requested_sources: [],
    source_request_ids: [],
    postmortem_rule_ids: [],
    evidence_snapshot_id: null,
    resolution_id: null,
    scorecard_id: null,
    judge_audit_id: null,
    postmortem_id: null,
    forecast_mode: "live",
    source_question_id: question.source_market_id,
    source_market_id: question.source_market_id,
    external_source: "polymarket",
    external_source_url: question.source_url,
    audit_trail: [
      {
        at: createdAt,
        action: "session_created_from_polymarket",
        details: `source_market_id=${question.source_market_id}; category=${question.category}`,
      },
    ],
  };

  await saveReplaySession(session);
  return session;
}
