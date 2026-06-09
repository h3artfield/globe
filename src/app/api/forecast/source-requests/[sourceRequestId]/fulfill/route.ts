import { NextResponse } from "next/server";
import { fulfillSourceRequest } from "@/lib/forecasting/sourceRequestStore";

type RouteContext = {
  params: Promise<{ sourceRequestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  let body: {
    fulfilled_by?: string;
    fulfillment_notes?: string;
    suggested_local_path?: string;
    linked_evidence_snapshot_id?: string;
  };
  try {
    body = (await request.json()) as {
      fulfilled_by?: string;
      fulfillment_notes?: string;
      suggested_local_path?: string;
      linked_evidence_snapshot_id?: string;
    };
  } catch {
    body = {};
  }

  try {
    const updated = await fulfillSourceRequest(sourceRequestId, body);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fulfillment failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
