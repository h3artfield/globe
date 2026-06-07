import { NextResponse } from "next/server";
import { createSourceRequest, findClaimInDrafts, updateDraftClaim } from "@/lib/review/reviewWorkflow";

type RouteContext = { params: Promise<{ claimId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { claimId } = await context.params;
  const found = await findClaimInDrafts(claimId);
  const claim = await updateDraftClaim(claimId, "needs_better_sources", "Reviewer requested better sources.");
  if (!claim || !found?.draft.country_code) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const sourceRequest = await createSourceRequest(found.draft.country_code, found.draft.module, [claim.text]);
  return NextResponse.json({ claim, sourceRequest });
}
