import { NextResponse } from "next/server";
import type { AskRequest, AskResponse } from "@/types/api";
import { buildRetrievalContext } from "@/lib/rag/buildRetrievalContext";
import { summarizeMetrics } from "@/lib/rag/loadPipelineRag";
import { saveAnswerAudit } from "@/lib/pilot/answerAudit";

function isNarrativeEvidenceModule(moduleName: string): boolean {
  return !["scorecard", "economy", "household_income_wealth", "production_industry"].includes(moduleName);
}

function isAdversaryQuestion(question: string): boolean {
  const normalizedQuestion = question.toLowerCase();
  return ["enemy", "enemies", "adversary", "adversaries", "rival", "threat", "becoming enemies"].some((term) =>
    normalizedQuestion.includes(term),
  );
}

function buildGroundedAnswer(input: {
  question: string;
  contextLines: string[];
  missingData: string[];
  narrativeEvidenceCount: number;
}) {
  const adversaryQuestion = isAdversaryQuestion(input.question);
  const hasNarrativeEvidence = input.narrativeEvidenceCount > 0;

  if (adversaryQuestion && !hasNarrativeEvidence) {
    return [
      `Question: ${input.question}`,
      "",
      "Short answer: I do not have enough source-backed USA-Egypt adversary or crisis evidence to claim what would make them enemies.",
      "",
      "What the current context can support:",
      "- The retrieved source-backed material is mostly structured World Bank economic/scorecard data.",
      "- The relevant adversary, threat perception, foreign policy, crisis history, sanctions, public opinion, and diplomatic-break evidence is missing or still pending review.",
      "",
      "What would need to be sourced before answering confidently:",
      "- Official US and Egyptian threat assessments or military doctrine naming the other side as a threat.",
      "- Sanctions, aid suspension, treaty rupture, basing-access disputes, or formal diplomatic breaks.",
      "- Documented military incidents, proxy-conflict support, or coercive actions involving both countries.",
      "- Public-opinion data or state rhetoric showing adversary narratives.",
      "- Major news/institutional timelines showing a sustained deterioration in the relationship.",
      "",
      "Useful retrieved context:",
      input.contextLines.length > 0 ? input.contextLines.join("\n") : "No source-backed chunks were retrieved.",
      "",
      `Missing or weak data: ${input.missingData.length > 0 ? input.missingData.join(" | ") : "none reported"}.`,
    ].join("\n");
  }

  return [
    `Question: ${input.question}`,
    "",
    "Source-grounded answer:",
    hasNarrativeEvidence
      ? "The answer below is limited to retrieved source-backed chunks and metrics."
      : "The retrieved context is thin for this question; treat this as a source audit, not a complete intelligence judgment.",
    "",
    "Retrieved context used:",
    input.contextLines.length > 0 ? input.contextLines.join("\n") : "No high-confidence chunks were retrieved.",
    "",
    "Grounding rules: use only supplied context, separate facts from inference, prefer official/structured data over Wikipedia, and report missing data.",
    input.missingData.length > 0 ? `Missing or weak data: ${input.missingData.join(" | ")}` : "Missing or weak data: none reported.",
  ].join("\n");
}

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
      ...retrievalContext.citations
        .map((citation) => citation.review_status)
        .filter((status): status is string => Boolean(status)),
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
  const narrativeEvidenceChunks = retrievalContext.retrievedChunks.filter(
    (chunk) => chunk.source_ids.length > 0 && isNarrativeEvidenceModule(chunk.module),
  );
  const contextLines = retrievalContext.retrievedChunks.slice(0, 6).map((chunk) => {
    const scope = chunk.country_code ?? chunk.relationship_id ?? "context";
    return `- [${chunk.chunk_id}] ${scope}.${chunk.module}: ${chunk.text.slice(0, 500)}`;
  });
  const answerText = buildGroundedAnswer({
    question: body.question,
    contextLines,
    missingData,
    narrativeEvidenceCount: narrativeEvidenceChunks.length,
  });

  const responsePayload: AskResponse & Record<string, unknown> = {
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
  };
  if (body.debug && body.saveAudit) {
    const responseForAudit = { ...responsePayload };
    delete responseForAudit.answer_audit;
    responsePayload.answer_audit = await saveAnswerAudit({
      question: body.question,
      selectedCountries: body.selectedCountries,
      response: responseForAudit,
    });
  }
  return NextResponse.json(responsePayload);
}
