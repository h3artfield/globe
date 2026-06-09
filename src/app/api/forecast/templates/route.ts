import { NextResponse } from "next/server";
import { loadReplayTemplates } from "@/lib/forecasting/loadReplayTemplates";
import type { ReplayTemplateListResponse } from "@/types/forecasting";

export async function GET() {
  const templates = await loadReplayTemplates();
  const body: ReplayTemplateListResponse = {
    templates,
    count: templates.length,
  };
  return NextResponse.json(body);
}
