import { NextResponse } from "next/server";
import {
  loadSourceRequest,
  updateSourceRequestStatus,
} from "@/lib/forecasting/sourceRequestStore";
import type { ForecastSourceRequestStatus } from "@/types/forecasting";

type RouteContext = {
  params: Promise<{ sourceRequestId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  let body: { status?: ForecastSourceRequestStatus; fulfillment_notes?: string };
  try {
    body = (await request.json()) as { status?: ForecastSourceRequestStatus; fulfillment_notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const allowed: ForecastSourceRequestStatus[] = ["fulfilled", "rejected", "unavailable"];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: "status must be fulfilled, rejected, or unavailable" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateSourceRequestStatus(
      sourceRequestId,
      body.status,
      body.fulfillment_notes,
    );
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  const sourceRequest = await loadSourceRequest(sourceRequestId);
  if (!sourceRequest) {
    return NextResponse.json({ error: `Source request not found: ${sourceRequestId}` }, { status: 404 });
  }
  return NextResponse.json(sourceRequest);
}
