import { NextResponse } from "next/server";
import type { PolymarketQuestionQuery, QuestionResolutionStatus } from "@/types/forecasting";
import { queryPolymarketQuestions } from "@/lib/forecasting/polymarket/questionStore";

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query: PolymarketQuestionQuery = {
    category: url.searchParams.get("category") ?? undefined,
    status: (url.searchParams.get("status") as QuestionResolutionStatus | null) ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    relationship: url.searchParams.get("relationship") ?? undefined,
    topic: url.searchParams.get("topic") ?? undefined,
    min_volume: parseNumber(url.searchParams.get("min_volume")),
    min_liquidity: parseNumber(url.searchParams.get("min_liquidity")),
    closing_before: url.searchParams.get("closing_before") ?? undefined,
    closing_after: url.searchParams.get("closing_after") ?? undefined,
    sort:
      (url.searchParams.get("sort") as PolymarketQuestionQuery["sort"] | null) ?? "volume",
    limit: parseNumber(url.searchParams.get("limit")) ?? 100,
  };

  const questions = queryPolymarketQuestions(query);
  return NextResponse.json({ questions, count: questions.length, query });
}
