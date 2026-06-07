import { NextResponse } from "next/server";
import { buildRelationshipSourceGapReport } from "@/lib/pilot/sourceGaps";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { relationshipId } = await context.params;
  return NextResponse.json(await buildRelationshipSourceGapReport(relationshipId));
}
