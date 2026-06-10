import { NextResponse } from "next/server";
import { rejectTuningProposal } from "@/lib/forecasting/acceptTuningProposal";

type RouteContext = {
  params: Promise<{ agentId: string; proposalId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { agentId, proposalId } = await context.params;
  try {
    const proposal = await rejectTuningProposal(agentId, proposalId);
    return NextResponse.json({ proposal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reject failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
