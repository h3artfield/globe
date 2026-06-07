import { NextResponse } from "next/server";
import { loadCountryModules } from "@/lib/rag/loadPipelineRag";

type RouteContext = {
  params: Promise<{ countryCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const modules = await loadCountryModules(countryCode);

  if (modules.length === 0) {
    return NextResponse.json({ error: "Country modules not found." }, { status: 404 });
  }

  return NextResponse.json({ country_code: modules[0].country_code, modules });
}
