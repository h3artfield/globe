import type { ResolveFromMarketResult, ReplaySession } from "@/types/forecasting";
import { resolveReplaySession } from "@/lib/forecasting/resolveReplaySession";
import {
  isPolymarketLiveSession,
  refreshPolymarketMarket,
} from "@/lib/forecasting/polymarket/refreshPolymarketMarket";
import { isPolymarketMockMode } from "@/lib/forecasting/polymarket/polymarketConfig";
import { getPolymarketQuestionById } from "@/lib/forecasting/polymarket/questionStore";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

function assertResolveFromMarketAllowed(session: ReplaySession): void {
  if (!isPolymarketLiveSession(session)) {
    throw new ReplaySessionValidationError(
      "Resolve-from-market is only available for live Polymarket sessions",
    );
  }
  if (session.status === "draft") {
    throw new ReplaySessionValidationError(
      "Resolution requires a locked forecast; session is still draft",
    );
  }
  if (session.status === "resolved") {
    throw new ReplaySessionValidationError("Session is already resolved");
  }
  if (session.status !== "locked") {
    throw new ReplaySessionValidationError(
      `Resolution requires locked status (current=${session.status})`,
    );
  }
}

export async function resolveReplaySessionFromPolymarketMarket(
  sessionId: string,
): Promise<ResolveFromMarketResult> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }

  assertResolveFromMarketAllowed(session);

  const sourceMarketId = session.source_market_id ?? session.source_question_id;
  if (!sourceMarketId) {
    throw new ReplaySessionValidationError("Session has no linked Polymarket source market id");
  }

  const existing = getPolymarketQuestionById(sourceMarketId);
  const mockState = isPolymarketMockMode()
    ? existing?.resolution_status === "resolved"
      ? "resolved"
      : "open"
    : undefined;
  const { question, refresh } = await refreshPolymarketMarket(sourceMarketId, {
    mock_state: mockState,
    session_id: sessionId,
  });

  if (question.resolution_status !== "resolved" || !question.winning_outcome) {
    return {
      resolved: false,
      message: "not resolved yet",
      refresh,
    };
  }

  const resolution = await resolveReplaySession(sessionId);
  return {
    resolved: true,
    message: `Market resolved with outcome ${question.winning_outcome}.`,
    resolution,
    refresh,
  };
}

export async function refreshPolymarketMarketForSession(sessionId: string): Promise<{
  question: import("@/types/forecasting").ForecastQuestionSourceMarket;
  refresh: import("@/types/forecasting").PolymarketMarketRefresh;
}> {
  const session = await loadReplaySession(sessionId);
  if (!session) {
    throw new ReplaySessionValidationError(`Session not found: ${sessionId}`);
  }
  if (!isPolymarketLiveSession(session)) {
    throw new ReplaySessionValidationError(
      "Market refresh is only available for live Polymarket sessions",
    );
  }
  if (session.status !== "draft" && session.status !== "locked") {
    throw new ReplaySessionValidationError(
      `Market refresh is only allowed on draft or locked sessions (status=${session.status})`,
    );
  }

  const sourceMarketId = session.source_market_id ?? session.source_question_id;
  if (!sourceMarketId) {
    throw new ReplaySessionValidationError("Session has no linked Polymarket source market id");
  }

  return refreshPolymarketMarket(sourceMarketId, {
    mock_state: "open",
    session_id: sessionId,
  });
}
