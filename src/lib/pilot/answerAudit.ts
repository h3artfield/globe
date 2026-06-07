import type { AnswerAuditRecord } from "@/types/pilot";
import type { AskResponse } from "@/types/api";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

export async function saveAnswerAudit(input: {
  question: string;
  selectedCountries: string[];
  response: AskResponse;
}): Promise<AnswerAuditRecord> {
  const auditId = `audit_${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_")}`;
  const reviewStatusSummary = Object.fromEntries(
    (input.response.review_statuses ?? []).map((status) => [
      status,
      (input.response.chunks_used ?? []).filter((chunk) => chunk.review_status === status).length,
    ]),
  );
  const record: AnswerAuditRecord = {
    audit_id: auditId,
    created_at: new Date().toISOString(),
    question: input.question,
    selectedCountries: input.selectedCountries,
    modules_used: input.response.modules_used ?? [],
    chunks_used: input.response.chunks_used ?? [],
    metrics_used: input.response.metrics_used ?? [],
    events_used: input.response.events_used ?? [],
    citations: input.response.citations ?? [],
    review_status_summary: reviewStatusSummary,
    missing_data: input.response.missingData,
    warning_badges: input.response.warning_badges ?? [],
    retrieval_debug: input.response.retrieval_debug ?? null,
    answer: input.response.answer,
    response: input.response,
  };
  await writeJsonFile(repoPath("data", "audits", "answers", `${auditId}.json`), record);
  return record;
}
