import { NextResponse } from "next/server";
import { loadCountryWorldModule } from "@/lib/worldModel/loadWorldModel";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const module = await loadCountryWorldModule(countryCode, "allies_and_partners");
  return module
    ? NextResponse.json(module)
    : NextResponse.json({ error: "Allies module not found." }, { status: 404 });
}
