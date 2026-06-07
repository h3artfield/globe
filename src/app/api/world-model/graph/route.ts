import { NextResponse } from "next/server";
import { loadWorldRelationshipGraph } from "@/lib/worldModel/loadWorldModel";

export async function GET() {
  const graph = await loadWorldRelationshipGraph();
  return graph
    ? NextResponse.json(graph)
    : NextResponse.json({ error: "World relationship graph not found." }, { status: 404 });
}
