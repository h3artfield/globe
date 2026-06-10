import { NextResponse } from "next/server";
import { createComparisonReplay } from "@/lib/forecasting/createComparisonReplay";
import { listComparisonGroups } from "@/lib/forecasting/replayComparisonStore";
import { ReplaySessionValidationError } from "@/lib/forecasting/replaySessionValidation";

export async function GET() {
  const comparisons = await listComparisonGroups();
  return NextResponse.json({ comparisons, count: comparisons.length });
}

export async function POST(request: Request) {
  let body: {
    template_id?: string;
    target?: string;
    year?: number;
    agent_ids?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.template_id || !body.target || body.year === undefined || !body.agent_ids) {
    return NextResponse.json(
      { error: "template_id, target, year, and agent_ids are required" },
      { status: 400 },
    );
  }

  try {
    const group = await createComparisonReplay({
      template_id: body.template_id,
      target: body.target,
      year: body.year,
      agent_ids: body.agent_ids,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    if (error instanceof ReplaySessionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
