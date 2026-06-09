import { NextResponse } from "next/server";
import {
  createSessionSourceRequest,
  listSessionSourceRequests,
} from "@/lib/forecasting/sessionSourceRequests";
import type { CreateSourceRequestInput } from "@/types/forecasting";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const requests = await listSessionSourceRequests(sessionId);
  return NextResponse.json({ requests, count: requests.length });
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  let body: CreateSourceRequestInput;
  try {
    body = (await request.json()) as CreateSourceRequestInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.request_type || !body.requested_source_id || !body.reason?.trim()) {
    return NextResponse.json(
      { error: "request_type, requested_source_id, and reason are required" },
      { status: 400 },
    );
  }

  try {
    const sourceRequest = await createSessionSourceRequest(sessionId, body);
    return NextResponse.json(sourceRequest, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      const status = error.message.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
