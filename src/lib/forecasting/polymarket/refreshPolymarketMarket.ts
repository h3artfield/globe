import type {
  ForecastQuestionSourceMarket,
  PolymarketMarketRefresh,
  PolymarketRefreshRequest,
  PolymarketRefreshResult,
} from "@/types/forecasting";
import {
  fetchPolymarketMarketRecord,
  type PolymarketMockMarketState,
} from "@/lib/forecasting/polymarket/gammaClient";
import {
  appendMarketRefresh,
  createMarketRefreshId,
} from "@/lib/forecasting/polymarket/marketRefreshStore";
import { normalizePolymarketMarket } from "@/lib/forecasting/polymarket/normalizePolymarketMarket";
import {
  isPolymarketMockMode,
} from "@/lib/forecasting/polymarket/polymarketConfig";
import {
  getPolymarketQuestionById,
  listIndexedPolymarketSourceMarketIds,
  upsertQuestionIndex,
  upsertQuestionsJsonl,
} from "@/lib/forecasting/polymarket/questionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function parseMarketId(sourceMarketId: string): string {
  return sourceMarketId.startsWith("polymarket_")
    ? sourceMarketId.slice("polymarket_".length)
    : sourceMarketId;
}

function buildRefreshRecord(
  question: ForecastQuestionSourceMarket,
  fetchedAt: string,
  usedMock: boolean,
  sessionId?: string | null,
): PolymarketMarketRefresh {
  return {
    refresh_id: createMarketRefreshId(),
    source_market_id: question.source_market_id,
    market_id: question.market_id,
    session_id: sessionId ?? null,
    fetched_at: fetchedAt,
    title: question.title,
    description: question.description,
    market_status: question.resolution_status,
    outcomes: question.outcomes,
    outcome_prices: question.outcome_prices,
    implied_probability: question.implied_probability,
    volume: question.volume,
    liquidity: question.liquidity,
    end_date: question.end_date,
    resolution_status: question.resolution_status,
    winning_outcome: question.winning_outcome ?? null,
    source_url: question.source_url,
    refresh_mode: usedMock ? "mock" : "live",
  };
}

export async function refreshPolymarketMarket(
  sourceMarketId: string,
  options?: {
    use_mock?: boolean;
    mock_state?: PolymarketMockMarketState;
    session_id?: string | null;
  },
): Promise<{ question: ForecastQuestionSourceMarket; refresh: PolymarketMarketRefresh }> {
  const existing = getPolymarketQuestionById(sourceMarketId);
  if (!existing) {
    throw new ReplaySessionValidationError(`Polymarket question not found: ${sourceMarketId}`);
  }

  const useMock = options?.use_mock ?? isPolymarketMockMode();
  const marketId = parseMarketId(sourceMarketId);
  const fetched = await fetchPolymarketMarketRecord(marketId, {
    forceMock: useMock,
    mockState: options?.mock_state ?? "open",
  });
  if (!fetched) {
    throw new ReplaySessionValidationError(`Polymarket market not found: ${marketId}`);
  }

  const fetchedAt = new Date().toISOString();
  const updated = normalizePolymarketMarket(
    fetched.event,
    fetched.market,
    existing.category,
    fetchedAt,
    existing.raw_record_path,
  );
  updated.imported_at = existing.imported_at;
  updated.last_refreshed_at = fetchedAt;

  upsertQuestionIndex([updated]);
  await upsertQuestionsJsonl([updated]);

  const refresh = buildRefreshRecord(updated, fetchedAt, useMock, options?.session_id);
  await appendMarketRefresh(refresh);

  return { question: updated, refresh };
}

export async function refreshPolymarketQuestions(
  request: PolymarketRefreshRequest = {},
): Promise<PolymarketRefreshResult> {
  const useMock = request.use_mock ?? isPolymarketMockMode();
  const mockState = request.mock_state ?? "open";
  const targetIds =
    request.source_market_ids?.length && request.source_market_ids.length > 0
      ? request.source_market_ids
      : listIndexedPolymarketSourceMarketIds();

  const refreshes: PolymarketMarketRefresh[] = [];
  for (const sourceMarketId of targetIds) {
    try {
      const result = await refreshPolymarketMarket(sourceMarketId, {
        use_mock: useMock,
        mock_state: mockState,
      });
      refreshes.push(result.refresh);
    } catch {
      continue;
    }
  }

  return {
    refreshed_count: refreshes.length,
    used_mock: useMock,
    refreshes,
  };
}

export function isPolymarketLiveSession(session: {
  forecast_mode: string;
  external_source: string | null;
  source_market_id: string | null;
  source_question_id: string | null;
}): boolean {
  return (
    session.forecast_mode === "live" &&
    session.external_source === "polymarket" &&
    Boolean(session.source_market_id || session.source_question_id)
  );
}
