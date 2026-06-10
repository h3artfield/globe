import { NextResponse } from "next/server";
import type { GdeltNewsIngestRequest } from "@/types/forecasting";
import { ingestGdeltNews } from "@/lib/forecasting/gdelt/ingestGdeltNews";
import { isGdeltLiveFetchAllowed } from "@/lib/forecasting/gdelt/gdeltNewsConfig";

export async function POST(request: Request) {
  let body: GdeltNewsIngestRequest = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as GdeltNewsIngestRequest;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wantsLive = body.use_mock === false;
  if (wantsLive && !isGdeltLiveFetchAllowed()) {
    return NextResponse.json(
      {
        error:
          "Live GDELT fetch disabled. Set GDELT_ALLOW_LIVE_FETCH=true or use mock ingest.",
      },
      { status: 403 },
    );
  }

  const result = await ingestGdeltNews(body);
  return NextResponse.json(result);
}
