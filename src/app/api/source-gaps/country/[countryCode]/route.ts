import { NextResponse } from "next/server";
import { buildCountrySourceGapReport } from "@/lib/pilot/sourceGaps";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  return NextResponse.json(await buildCountrySourceGapReport(countryCode.toUpperCase()));
}
