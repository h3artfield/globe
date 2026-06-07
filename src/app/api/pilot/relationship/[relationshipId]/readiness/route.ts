import { NextResponse } from "next/server";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { buildPilotReadiness } from "@/lib/pilot/readiness";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { relationshipId } = await context.params;
  const [a, b] = relationshipId.split("_");
  return NextResponse.json(await buildPilotReadiness(buildRelationshipId(a, b), "relationship"));
}
