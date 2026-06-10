import { NextResponse } from "next/server";
import {
  listFilteredSourceRequests,
  type SourceRequestFilters,
} from "@/lib/forecasting/listFilteredSourceRequests";
import type {
  ForecastSourceRequestPriority,
  ForecastSourceRequestStatus,
  ForecastSourceRequestType,
} from "@/types/forecasting";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cutoffYearRaw = url.searchParams.get("cutoff_year");

  const filters: SourceRequestFilters = {
    status: (url.searchParams.get("status") as ForecastSourceRequestStatus | null) ?? undefined,
    request_type:
      (url.searchParams.get("request_type") as ForecastSourceRequestType | null) ?? undefined,
    priority: (url.searchParams.get("priority") as ForecastSourceRequestPriority | null) ?? undefined,
    source_id: url.searchParams.get("source_id") ?? undefined,
    agent_id: url.searchParams.get("agent_id") ?? undefined,
    template_id: url.searchParams.get("template_id") ?? undefined,
    country_iso3: url.searchParams.get("country_iso3") ?? undefined,
    relationship_pair: url.searchParams.get("relationship_pair") ?? undefined,
    cutoff_year: cutoffYearRaw ? Number(cutoffYearRaw) : undefined,
  };

  const requests = await listFilteredSourceRequests(filters);
  return NextResponse.json({ requests, count: requests.length, filters });
}
