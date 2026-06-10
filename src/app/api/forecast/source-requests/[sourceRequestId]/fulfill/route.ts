import { NextResponse } from "next/server";
import { fulfillSourceRequestWithArtifact } from "@/lib/forecasting/fulfillSourceRequestWithArtifact";
import type { FulfillSourceRequestBody } from "@/types/forecasting";

type RouteContext = {
  params: Promise<{ sourceRequestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  let body: FulfillSourceRequestBody;
  try {
    body = (await request.json()) as FulfillSourceRequestBody;
  } catch {
    body = {};
  }

  if (!body.note_text && body.fulfillment_notes && !body.local_path && !body.local_paths?.length) {
    body = { ...body, note_text: body.fulfillment_notes };
  }

  try {
    const result = await fulfillSourceRequestWithArtifact(sourceRequestId, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fulfillment failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
