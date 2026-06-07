import { NextResponse } from "next/server";
import { loadCountryScorecard } from "@/lib/rag/loadPipelineRag";

type RouteContext = {
  params: Promise<{ countryCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const scorecard = await loadCountryScorecard(countryCode);

  if (!scorecard) {
    return NextResponse.json({ error: "Country scorecard not found." }, { status: 404 });
  }

  return NextResponse.json(scorecard);
}
