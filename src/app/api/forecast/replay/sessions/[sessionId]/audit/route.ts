import { NextResponse } from "next/server";
import { getReplayJudgeAudit } from "@/lib/forecasting/runReplayJudge";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const audit = await getReplayJudgeAudit(sessionId);
  if (!audit) {
    return NextResponse.json(
      { error: "missing_audit", message: `No judge audit for session ${sessionId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(audit);
}
