import { NextResponse } from "next/server";
import { loadCountryChunks } from "@/lib/rag/loadPipelineRag";

type RouteContext = {
  params: Promise<{ countryCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const chunks = await loadCountryChunks(countryCode);

  if (chunks.length === 0) {
    return NextResponse.json({ error: "Country chunks not found." }, { status: 404 });
  }

  return NextResponse.json({ country_code: countryCode.toUpperCase(), chunks });
}
