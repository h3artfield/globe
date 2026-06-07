import { NextResponse } from "next/server";
import { preserveRejectedClaim, updateDraftClaim } from "@/lib/review/reviewWorkflow";

type RouteContext = { params: Promise<{ claimId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { claimId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const claim = await updateDraftClaim(claimId, "rejected", body.reason ?? "Rejected by reviewer.");
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  await preserveRejectedClaim(claim, body.reason ?? "Rejected by reviewer.");
  return NextResponse.json({ claim });
}
