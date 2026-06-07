import { NextResponse } from "next/server";
import { listReviewItems } from "@/lib/review/reviewWorkflow";

export async function GET() {
  return NextResponse.json({ items: await listReviewItems() });
}
