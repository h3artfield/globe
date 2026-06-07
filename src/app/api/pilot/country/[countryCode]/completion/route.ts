import { NextResponse } from "next/server";
import { buildCountryCompletionScore } from "@/lib/pilot/completionScore";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  return NextResponse.json(await buildCountryCompletionScore(countryCode.toUpperCase()));
}
