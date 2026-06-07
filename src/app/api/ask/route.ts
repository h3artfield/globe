import { NextResponse } from "next/server";
import type { AskRequest } from "@/types/api";
import { askStrategicQuestion } from "@/lib/ai/askStrategicQuestion";
import { buildRagContext } from "@/lib/rag/buildRagContext";
import { loadPipelineAskContext, summarizeMetrics } from "@/lib/rag/loadPipelineRag";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AskRequest>;

  if (!body.question || typeof body.question !== "string") {
    return NextResponse.json({ error: "A non-empty question is required." }, { status: 400 });
  }

  if (!Array.isArray(body.selectedCountries) || body.selectedCountries.length === 0) {
    return NextResponse.json(
      { error: "At least one selected country ISO3 code is required." },
      { status: 400 },
    );
  }

  const ragContext = await buildRagContext(body.selectedCountries);
  const pipelineContext = await loadPipelineAskContext(body.selectedCountries);
  const answer = await askStrategicQuestion(body.question, ragContext);
  const modulesUsed = [
    ...pipelineContext.countryModules.map(
      (module) => `${module.country_code}.${module.module}`,
    ),
    ...pipelineContext.relationshipModules.map(
      (module) => `${module.relationship_id}.${module.module}`,
    ),
  ];
  const metricsUsed = summarizeMetrics(pipelineContext.metrics);
  const sourceIds = Array.from(new Set([...answer.sourceIds, ...pipelineContext.sourceIds])).sort();
  const missingData = Array.from(
    new Set([...answer.missingData, ...pipelineContext.missingData]),
  ).sort();

  return NextResponse.json({
    ...answer,
    sourceIds,
    missingData,
    modules_used: modulesUsed,
    metrics_used: metricsUsed,
    source_ids: sourceIds,
    missing_data: missingData,
    strategic_summary: {
      main_incentives: answer.strategicSummary.mainIncentives,
      main_constraints: answer.strategicSummary.mainConstraints,
      likely_moves: answer.strategicSummary.likelyMoves,
      escalation_risks: answer.strategicSummary.escalationRisks,
      deescalation_options: answer.strategicSummary.deescalationOptions,
    },
    pipeline_context: {
      relationship_ids: pipelineContext.relationshipIds,
      country_coverage_reports: pipelineContext.countryCoverages,
      relationship_coverage_reports: pipelineContext.relationshipCoverages,
      country_chunks_loaded: pipelineContext.countryChunks.length,
      relationship_chunks_loaded: pipelineContext.relationshipChunks.length,
    },
  });
}
