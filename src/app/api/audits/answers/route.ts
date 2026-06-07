import { NextResponse } from "next/server";
import type { AskResponse } from "@/types/api";
import { saveAnswerAudit } from "@/lib/pilot/answerAudit";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question: string;
    selectedCountries: string[];
    response: AskResponse;
  };
  return NextResponse.json(await saveAnswerAudit(body));
}
