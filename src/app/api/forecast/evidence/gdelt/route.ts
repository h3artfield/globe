import { NextResponse } from "next/server";
import type { GdeltNewsQuery } from "@/types/forecasting";
import { queryNewsEvidence } from "@/lib/forecasting/gdelt/newsEvidenceStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query: GdeltNewsQuery = {
    query: url.searchParams.get("query") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    relationship: url.searchParams.get("relationship") ?? undefined,
    topic: url.searchParams.get("topic") ?? undefined,
    start_date: url.searchParams.get("start_date") ?? undefined,
    end_date: url.searchParams.get("end_date") ?? undefined,
    sort:
      (url.searchParams.get("sort") as GdeltNewsQuery["sort"]) ?? "published_at",
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : 50,
  };

  const records = queryNewsEvidence(query);
  return NextResponse.json({ records, count: records.length, query });
}
