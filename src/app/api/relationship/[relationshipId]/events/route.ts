import { NextResponse } from "next/server";
import { loadRelationshipWorldEvents } from "@/lib/worldModel/loadWorldModel";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { relationshipId } = await context.params;
  const events = await loadRelationshipWorldEvents(relationshipId);
  return events
    ? NextResponse.json(events)
    : NextResponse.json({ error: "Relationship event timeline not found." }, { status: 404 });
}
