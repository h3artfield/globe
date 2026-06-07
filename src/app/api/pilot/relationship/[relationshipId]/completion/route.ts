import { NextResponse } from "next/server";
import { buildRelationshipCompletionScore } from "@/lib/pilot/completionScore";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { relationshipId } = await context.params;
  const [a, b] = relationshipId.split("_");
  return NextResponse.json(await buildRelationshipCompletionScore(buildRelationshipId(a, b)));
}
