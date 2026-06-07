import { NextResponse } from "next/server";
import { getReviewItem } from "@/lib/review/reviewWorkflow";

type RouteContext = { params: Promise<{ reviewId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { reviewId } = await context.params;
  const item = await getReviewItem(reviewId);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "Review item not found" }, { status: 404 });
}
