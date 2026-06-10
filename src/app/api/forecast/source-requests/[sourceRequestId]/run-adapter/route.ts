import { NextResponse } from "next/server";
import { fulfillSourceRequestWithArtifact } from "@/lib/forecasting/fulfillSourceRequestWithArtifact";
import { loadSourceRequest } from "@/lib/forecasting/sourceRequestStore";
import type { FulfillSourceRequestBody } from "@/types/forecasting";

type RouteContext = {
  params: Promise<{ sourceRequestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  let body: FulfillSourceRequestBody & { adapter_id?: string };
  try {
    body = (await request.json()) as FulfillSourceRequestBody & { adapter_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.adapter_id?.trim()) {
    return NextResponse.json({ error: "adapter_id is required" }, { status: 400 });
  }

  const requestRecord = await loadSourceRequest(sourceRequestId);
  if (!requestRecord) {
    return NextResponse.json({ error: `Source request not found: ${sourceRequestId}` }, { status: 404 });
  }

  try {
    const result = await fulfillSourceRequestWithArtifact(sourceRequestId, {
      ...body,
      fulfillment_type: "local_adapter",
      adapter_id: body.adapter_id.trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adapter fulfillment failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
