import { readdir } from "node:fs/promises";
import type { CountryClaim, CountryModule, NarrativeDraft, ReviewQueueItem, ReviewStatus, SourceRequest } from "@/types/pipeline";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { pathExists, readJsonFile, repoPath, writeJsonFile, writeJsonLinesFile, readJsonLinesFile } from "@/lib/pipeline/io";

export async function listReviewItems(): Promise<ReviewQueueItem[]> {
  const dir = repoPath("data", "review_queue", "countries");
  const files = await readdir(dir).catch(() => []);
  const payloads = await Promise.all(
    files.filter((file) => file.endsWith(".json")).map((file) =>
      readJsonFile<{ items: ReviewQueueItem[] }>(repoPath("data", "review_queue", "countries", file)),
    ),
  );
  return payloads.flatMap((payload) => payload.items).sort((a, b) => a.review_id.localeCompare(b.review_id));
}

export async function getReviewItem(reviewId: string): Promise<ReviewQueueItem | null> {
  return (await listReviewItems()).find((item) => item.review_id === reviewId) ?? null;
}

export async function updateReviewItem(updated: ReviewQueueItem): Promise<void> {
  if (!updated.country_code) return;
  const filePath = repoPath("data", "review_queue", "countries", `${updated.country_code}.json`);
  const payload = (await pathExists(filePath))
    ? await readJsonFile<{ country_code: string; generated_at: string; items: ReviewQueueItem[] }>(filePath)
    : { country_code: updated.country_code, generated_at: new Date().toISOString(), items: [] };
  const nextItems = payload.items.some((item) => item.review_id === updated.review_id)
    ? payload.items.map((item) => item.review_id === updated.review_id ? updated : item)
    : [...payload.items, updated];
  await writeJsonFile(filePath, { ...payload, generated_at: new Date().toISOString(), items: nextItems });
}

export async function loadCountryModule(countryCode: string, moduleName: string): Promise<CountryModule> {
  return readJsonFile<CountryModule>(repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`));
}

export async function saveCountryModule(module: CountryModule): Promise<void> {
  await writeJsonFile(repoPath("data", "rag", "countries", module.country_code, `${module.module}.v1.json`), module);
}

export async function appendApprovedClaimToModule(countryCode: string, moduleName: string, claim: CountryClaim): Promise<void> {
  const module = await loadCountryModule(countryCode, moduleName);
  const claims = module.claims.some((existing) => existing.claim_id === claim.claim_id)
    ? module.claims.map((existing) => existing.claim_id === claim.claim_id ? claim : existing)
    : [...module.claims, claim];
  const nextModule: CountryModule = {
    ...module,
    claims,
    source_ids: Array.from(new Set([...module.source_ids, ...claim.source_ids])),
    review_status: claims.some((item) => item.review_status === "verified") ? "verified" : "human_reviewed",
    last_updated: new Date().toISOString().slice(0, 10),
  };
  await saveCountryModule(nextModule);
  await rebuildCountryChunks(countryCode);
}

export async function rebuildCountryChunks(countryCode: string): Promise<void> {
  const countryDir = repoPath("data", "rag", "countries", countryCode);
  const files = await readdir(countryDir).catch(() => []);
  const modules = await Promise.all(
    files.filter((file) => file.endsWith(".v1.json") && !["coverage_report.v1.json"].includes(file)).map((file) =>
      readJsonFile<CountryModule>(repoPath("data", "rag", "countries", countryCode, file)).catch(() => null),
    ),
  );
  const chunks = modules
    .filter((module): module is CountryModule => Boolean(module?.module))
    .map((module, index) => buildCountryChunk(module, index + 1));
  await writeJsonLinesFile(repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"), chunks);
}

export async function findClaimInDrafts(claimId: string): Promise<{ draft: NarrativeDraft; claim: CountryClaim } | null> {
  const draftsRoot = repoPath("data", "drafts", "countries");
  const countries = await readdir(draftsRoot).catch(() => []);
  for (const country of countries) {
    const modules = await readdir(repoPath("data", "drafts", "countries", country)).catch(() => []);
    for (const moduleName of modules) {
      const drafts = await readdir(repoPath("data", "drafts", "countries", country, moduleName)).catch(() => []);
      for (const draftFile of drafts.filter((file) => file.endsWith(".json"))) {
        const draft = await readJsonFile<NarrativeDraft>(repoPath("data", "drafts", "countries", country, moduleName, draftFile));
        const claim = draft.claims.find((item) => item.claim_id === claimId);
        if (claim) return { draft, claim };
      }
    }
  }
  return null;
}

export async function findDraftById(draftId: string): Promise<NarrativeDraft | null> {
  const draftsRoot = repoPath("data", "drafts", "countries");
  const countries = await readdir(draftsRoot).catch(() => []);
  for (const country of countries) {
    const modules = await readdir(repoPath("data", "drafts", "countries", country)).catch(() => []);
    for (const moduleName of modules) {
      const draftPath = repoPath("data", "drafts", "countries", country, moduleName, `${draftId}.json`);
      if (await pathExists(draftPath)) return readJsonFile<NarrativeDraft>(draftPath);
    }
  }
  return null;
}

export async function updateDraftClaim(claimId: string, status: ReviewStatus, reason?: string): Promise<CountryClaim | null> {
  const found = await findClaimInDrafts(claimId);
  if (!found || !found.draft.country_code) return null;
  const updatedClaim: CountryClaim = {
    ...found.claim,
    review_status: status,
    notes: reason ? `${found.claim.notes}; review_reason=${reason}` : found.claim.notes,
    last_verified: status === "verified" || status === "human_reviewed" ? new Date().toISOString().slice(0, 10) : found.claim.last_verified,
  };
  const draft = {
    ...found.draft,
    claims: found.draft.claims.map((claim) => claim.claim_id === claimId ? updatedClaim : claim),
  };
  await writeJsonFile(repoPath("data", "drafts", "countries", found.draft.country_code, found.draft.module, `${found.draft.draft_id}.json`), draft);
  return updatedClaim;
}

export async function preserveRejectedClaim(claim: CountryClaim, reason: string): Promise<void> {
  await writeJsonFile(repoPath("data", "rejected_claims", `${claim.claim_id}.json`), {
    rejected_at: new Date().toISOString(),
    reason,
    claim,
  });
}

export async function createSourceRequest(countryCode: string, moduleName: string, questions: string[]): Promise<SourceRequest> {
  const request: SourceRequest = {
    request_id: `${countryCode}-${moduleName}-sources-${Date.now()}`,
    country_code: countryCode,
    module: moduleName,
    needed_for_questions: questions,
    suggested_source_types: ["official government biography", "parliament profile", "major news profile", "book/chapter", "think tank report"],
    priority: "high",
    status: "open",
    notes: "",
  };
  await writeJsonFile(repoPath("data", "source_requests", "countries", countryCode, `${moduleName}.json`), request);
  return request;
}

export async function getCountryChunks(countryCode: string) {
  return readJsonLinesFile(repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"));
}
