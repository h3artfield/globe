import { NextResponse } from "next/server";
import { generateNarrativeDraftForReviewItem } from "@/lib/dossier/narrativeDraftGenerator";

type RouteContext = { params: Promise<{ reviewId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { reviewId } = await context.params;
  return NextResponse.json(await generateNarrativeDraftForReviewItem(reviewId));
}
