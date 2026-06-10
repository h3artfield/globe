import { NextResponse } from "next/server";
import { acceptTuningProposal } from "@/lib/forecasting/acceptTuningProposal";
import { loadAgentStrategy } from "@/lib/forecasting/agentStrategyStore";

type RouteContext = {
  params: Promise<{ agentId: string; proposalId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { agentId, proposalId } = await context.params;
  try {
    const proposal = await acceptTuningProposal(agentId, proposalId);
    const strategy = await loadAgentStrategy(agentId);
    return NextResponse.json({ proposal, strategy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accept failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
