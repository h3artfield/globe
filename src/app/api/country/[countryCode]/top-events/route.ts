import { NextResponse } from "next/server";
import { loadCountryTopEvents } from "@/lib/worldModel/loadWorldModel";

type RouteContext = { params: Promise<{ countryCode: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { countryCode } = await context.params;
  const events = await loadCountryTopEvents(countryCode);
  return events
    ? NextResponse.json(events)
    : NextResponse.json({ error: "Country top events not found." }, { status: 404 });
}
