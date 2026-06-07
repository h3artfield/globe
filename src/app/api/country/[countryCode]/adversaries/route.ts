import { NextResponse } from "next/server";
import { loadCountryWorldModule } from "@/lib/worldModel/loadWorldModel";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const adversariesModule = await loadCountryWorldModule(countryCode, "adversaries_and_rivals");
  return adversariesModule
    ? NextResponse.json(adversariesModule)
    : NextResponse.json({ error: "Adversaries module not found." }, { status: 404 });
}
