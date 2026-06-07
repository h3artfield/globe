import { NextResponse } from "next/server";
import { appendApprovedClaimToModule, updateDraftClaim } from "@/lib/review/reviewWorkflow";

type RouteContext = { params: Promise<{ claimId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { claimId } = await context.params;
  const claim = await updateDraftClaim(claimId, "verified");
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const [countryCode, moduleName] = claim.claim_id.split("-").slice(0, 2);
  await appendApprovedClaimToModule(countryCode, moduleName, claim);
  return NextResponse.json({ claim });
}
