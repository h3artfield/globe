import { NextResponse } from "next/server";
import { buildPilotReadiness } from "@/lib/pilot/readiness";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  return NextResponse.json(await buildPilotReadiness(countryCode.toUpperCase(), "country"));
}
