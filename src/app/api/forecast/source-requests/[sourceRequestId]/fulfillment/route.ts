import { NextResponse } from "next/server";
import { loadSourceFulfillment } from "@/lib/forecasting/sourceFulfillmentStore";

type RouteContext = {
  params: Promise<{ sourceRequestId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sourceRequestId } = await context.params;
  const artifact = await loadSourceFulfillment(sourceRequestId);
  if (!artifact) {
    return NextResponse.json(
      { error: `No fulfillment artifact for request ${sourceRequestId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(artifact);
}
