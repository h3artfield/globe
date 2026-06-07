import { NextResponse } from "next/server";
import { findDraftById } from "@/lib/review/reviewWorkflow";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  const draft = await findDraftById(draftId);
  return draft ? NextResponse.json(draft) : NextResponse.json({ error: "Draft not found" }, { status: 404 });
}
