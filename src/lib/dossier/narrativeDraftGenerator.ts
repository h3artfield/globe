import { createHash } from "node:crypto";
import type { CountryClaim, NarrativeDraft } from "@/types/pipeline";
import { buildRetrievalContext } from "@/lib/rag/buildRetrievalContext";
import { questionsForModule, loadCountryQuestionBank } from "./countryQuestionBankLoader";
import { buildSourceGroundedModulePrompt } from "./modulePromptBuilder";
import { createSourceRequest, getReviewItem, updateReviewItem } from "@/lib/review/reviewWorkflow";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

function timestampId(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export async function generateNarrativeDraftForModule(countryCode: string, moduleName: string): Promise<NarrativeDraft> {
  const bank = await loadCountryQuestionBank();
  const questions = questionsForModule(bank, moduleName);
  const context = await buildRetrievalContext({
    question: `${countryCode} ${moduleName} ${questions.slice(0, 5).join(" ")}`,
    selectedCountries: [countryCode],
    mode: "source_audit",
  });
  const prompt = buildSourceGroundedModulePrompt({
    countryCode,
    moduleName,
    questions,
    chunks: context.retrievedChunks,
    metrics: context.retrievedMetrics,
  });
  const usableChunks = context.retrievedChunks.filter((chunk) => chunk.source_ids.length > 0);
  const claims: CountryClaim[] = usableChunks.slice(0, 5).map((chunk, index) => ({
    claim_id: `${countryCode}-${moduleName}-draft-${String(index + 1).padStart(3, "0")}`,
    text: chunk.text.slice(0, 500),
    claim_type: chunk.claim_type === "baseline_summary" ? "interpretation" : chunk.claim_type,
    source_ids: chunk.source_ids,
    confidence: chunk.confidence,
    review_status: "llm_drafted_unreviewed",
    last_verified: "",
    notes: `chunk_id=${chunk.chunk_id}; module=${chunk.module}`,
  }));

  const missingData = context.missingData.map((warning) => warning.message);
  if (claims.length === 0) {
    await createSourceRequest(countryCode, moduleName, questions);
  }

  const draftId = `draft_${timestampId()}`;
  const draft: NarrativeDraft = {
    draft_id: draftId,
    country_code: countryCode,
    relationship_id: null,
    module: moduleName,
    created_at: new Date().toISOString(),
    created_by: "llm",
    review_status: claims.length > 0 ? "llm_drafted_unreviewed" : "needs_better_sources",
    source_ids: Array.from(new Set(claims.flatMap((claim) => claim.source_ids))),
    claims,
    missing_data: missingData,
    warnings: claims.length === 0 ? ["No source-backed chunks available; source request created."] : [],
    prompt_hash: hashPrompt(prompt),
    model_provider: "mock_local",
    model_name: "source-grounded-template",
  };
  await writeJsonFile(repoPath("data", "drafts", "countries", countryCode, moduleName, `${draftId}.json`), draft);
  return draft;
}

export async function generateNarrativeDraftForReviewItem(reviewId: string): Promise<NarrativeDraft> {
  const item = await getReviewItem(reviewId);
  if (!item?.country_code) throw new Error(`Review item not found: ${reviewId}`);
  const draft = await generateNarrativeDraftForModule(item.country_code, item.module);
  await updateReviewItem({
    ...item,
    status: draft.claims.length > 0 ? "pending" : "pending",
    draft_ids: Array.from(new Set([...(item.draft_ids ?? []), draft.draft_id])),
    generation_status: draft.review_status === "needs_better_sources" ? "auto_generated_structured_data" : "llm_drafted_not_reviewed",
  });
  return draft;
}
