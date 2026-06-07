import { NextResponse } from "next/server";
import type { AskRequest } from "@/types/api";
import { buildRetrievalContext } from "@/lib/rag/buildRetrievalContext";
import { summarizeMetrics } from "@/lib/rag/loadPipelineRag";

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

  const retrievalContext = await buildRetrievalContext({
    question: body.question,
    selectedCountries: body.selectedCountries,
    mode: body.mode ?? "strategic",
  });
  const modulesUsed = retrievalContext.selectedModules;
  const chunksUsed = retrievalContext.retrievedChunks.map((chunk) => ({
    chunk_id: chunk.chunk_id,
    module: chunk.module,
    country_code: chunk.country_code,
    relationship_id: chunk.relationship_id,
    source_ids: chunk.source_ids,
    confidence: chunk.confidence,
    review_status: chunk.review_status,
  }));
  const metricsUsed = summarizeMetrics(retrievalContext.retrievedMetrics);
  const eventsUsed = retrievalContext.retrievedEvents.map((event) => ({
    event_id: event.event_id,
    event_date: event.event_date,
    event_type: event.event_type,
    country_codes: event.country_codes,
    relationship_id: event.relationship_id,
    importance_score: event.importance_score,
    source_ids: event.source_ids,
    confidence: event.confidence,
  }));
  const sourceIds = Array.from(new Set(retrievalContext.citations.map((citation) => citation.source_id))).sort();
  const missingData = retrievalContext.missingData.map((warning) => warning.message);
  const reviewStatuses = Array.from(
    new Set([
      ...retrievalContext.retrievedChunks.map((chunk) => chunk.review_status ?? "human_review_pending"),
      ...retrievalContext.retrievedMetrics.map((metric) => metric.review_status ?? "auto_generated_from_structured_data"),
      ...retrievalContext.citations.map((citation) => citation.review_status).filter(Boolean),
    ]),
  ).sort();
  const warningBadges = [
    retrievalContext.citations.every((citation) => citation.source_id === "wikipedia") && retrievalContext.citations.length > 0
      ? "Wikipedia baseline only"
      : null,
    reviewStatuses.includes("llm_drafted_unreviewed") ? "unreviewed narrative claims" : null,
    retrievalContext.retrievedMetrics.some((metric) => metric.freshness_status === "stale") ? "old metrics" : null,
    retrievalContext.missingData.some((warning) => warning.message.includes("demographic")) ? "missing demographic data" : null,
    retrievalContext.retrievedMetrics.some((metric) => (metric.sample_size ?? 9999) < 100) ? "small sample-size survey data" : null,
    retrievalContext.citations.some((citation) => citation.source_id.includes("manual")) ? "manual notes" : null,
  ].filter((badge): badge is string => Boolean(badge));
  const contextLines = retrievalContext.retrievedChunks.slice(0, 6).map((chunk) => {
    const scope = chunk.country_code ?? chunk.relationship_id ?? "context";
    return `- [${chunk.chunk_id}] ${scope}.${chunk.module}: ${chunk.text.slice(0, 500)}`;
  });
  const answerText = [
    `Question: ${body.question}`,
    "",
    "Retrieved context used for this answer:",
    contextLines.length > 0 ? contextLines.join("\n") : "No high-confidence chunks were retrieved.",
    "",
    "Grounding rules: use only supplied context, separate facts from inference, prefer official/structured data over Wikipedia, and report missing data.",
    missingData.length > 0 ? `Missing or weak data: ${missingData.join(" | ")}` : "Missing or weak data: none reported.",
  ].join("\n");

  return NextResponse.json({
    answer: answerText,
    selectedCountries: body.selectedCountries,
    strategicSummary: {
      mainIncentives: [],
      mainConstraints: missingData,
      likelyMoves: [],
      escalationRisks: [],
      deescalationOptions: [],
    },
    confidence: retrievalContext.citations.length > 0 ? "medium" : "low",
    missingData,
    sourceIds,
    citations: retrievalContext.citations,
    modules_used: modulesUsed,
    chunks_used: chunksUsed,
    metrics_used: metricsUsed,
    events_used: eventsUsed,
    source_ids: sourceIds,
    review_statuses: reviewStatuses,
    warning_badges: warningBadges,
    missing_data: missingData,
    strategic_summary: {
      main_incentives: [],
      main_constraints: missingData,
      likely_moves: [],
      escalation_risks: [],
      deescalation_options: [],
    },
    retrieval_debug: body.debug ? retrievalContext.retrievalDebug : undefined,
  });
}
