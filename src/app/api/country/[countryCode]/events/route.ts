import { NextResponse } from "next/server";
import { loadCountryWorldEvents } from "@/lib/worldModel/loadWorldModel";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const events = await loadCountryWorldEvents(countryCode);
  return events
    ? NextResponse.json(events)
    : NextResponse.json({ error: "Country event timeline not found." }, { status: 404 });
}
