import { NextResponse } from "next/server";
import { loadComparisonGroup } from "@/lib/forecasting/replayComparisonStore";
import { loadReplaySession } from "@/lib/forecasting/replaySessionStore";
import { getReplayScorecard } from "@/lib/forecasting/scoreReplaySession";
import { getReplayPostmortem } from "@/lib/forecasting/generateReplayPostmortem";
import { listSessionSourceRequests } from "@/lib/forecasting/sessionSourceRequests";

type RouteContext = {
  params: Promise<{ comparisonGroupId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { comparisonGroupId } = await context.params;
  const group = await loadComparisonGroup(comparisonGroupId);
  if (!group) {
    return NextResponse.json(
      { error: `Comparison group not found: ${comparisonGroupId}` },
      { status: 404 },
    );
  }

  const sessions = await Promise.all(
    group.session_ids.map(async (sessionId) => {
      const session = await loadReplaySession(sessionId);
      if (!session) {
        return null;
      }
      const [scorecard, postmortem, sourceRequests] = await Promise.all([
        getReplayScorecard(sessionId),
        getReplayPostmortem(sessionId),
        listSessionSourceRequests(sessionId),
      ]);
      return { session, scorecard, postmortem, sourceRequests };
    }),
  );

  return NextResponse.json({
    group,
    sessions: sessions.filter(Boolean),
  });
}
