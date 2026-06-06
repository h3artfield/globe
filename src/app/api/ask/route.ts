import { NextResponse } from "next/server";
import type { AskRequest } from "@/types/api";
import { askStrategicQuestion } from "@/lib/ai/askStrategicQuestion";
import { buildRagContext } from "@/lib/rag/buildRagContext";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AskRequest>;

  if (!body.question || typeof body.question !== "string") {
    return NextResponse.json({ error: "A non-empty question is required." }, { status: 400 });
  }

  if (!Array.isArray(body.selectedCountries) || body.selectedCountries.length === 0) {
    return NextResponse.json(
      { error: "At least one selected country ISO3 code is required." },
      { status: 400 },
    );
  }

  const ragContext = await buildRagContext(body.selectedCountries);
  const answer = await askStrategicQuestion(body.question, ragContext);

  return NextResponse.json(answer);
}
