import type { CountryModule } from "@/types/pipeline";
import { claimHasGrounding } from "./sourceGrounding";

export type ModuleDraftValidation = {
  errors: string[];
  warnings: string[];
  rejectedClaims: string[];
};

export function validateDossierModule(module: CountryModule): ModuleDraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rejectedClaims: string[] = [];

  for (const claim of module.claims) {
    if (!claim.claim_type) {
      errors.push(`${claim.claim_id}: generated claim has no claim_type`);
    }
    if (!claimHasGrounding(claim) && claim.review_status !== "needs_better_sources") {
      errors.push(`${claim.claim_id}: generated claim has no source grounding`);
    }
    if (module.module === "leader_dossiers" && claim.claim_type === "strategic_inference" && claim.notes.includes("marked_as_fact")) {
      errors.push(`${claim.claim_id}: leader dossier inference is marked as fact`);
    }
    if (claim.review_status === "rejected") {
      rejectedClaims.push(claim.claim_id);
    }
  }

  if (module.source_ids.length === 1 && module.source_ids[0] === "wikipedia") {
    warnings.push(`${module.country_code}.${module.module}: module is Wikipedia-only`);
  }
  const unreviewed = module.claims.filter((claim) => claim.review_status === "llm_drafted_unreviewed");
  if (module.claims.length > 0 && unreviewed.length / module.claims.length > 0.5) {
    warnings.push(`${module.country_code}.${module.module}: module is mostly unreviewed`);
  }
  if (module.module === "leader_dossiers" && module.claims.length === 0) {
    warnings.push(`${module.country_code}.${module.module}: leader dossier lacks current office source`);
  }
  if (module.module === "allies_and_partners" && module.claims.length === 0) {
    warnings.push(`${module.country_code}.${module.module}: allies module has no relationship evidence`);
  }
  if (module.module === "adversaries_and_rivals" && module.claims.length === 0) {
    warnings.push(`${module.country_code}.${module.module}: adversaries module has no relationship evidence`);
  }

  return { errors, warnings, rejectedClaims };
}
