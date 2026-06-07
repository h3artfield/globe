import { COUNTRY_MODULES, MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { readdir } from "node:fs/promises";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import type { CountryModule, NarrativeDraft } from "@/types/pipeline";
import { validateDossierModule } from "@/lib/dossier/moduleDraftValidator";

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const countryCode of MVP_COUNTRIES) {
    for (const moduleName of COUNTRY_MODULES) {
      const countryModule = await readJsonFile<CountryModule>(
        repoPath("data", "rag", "countries", countryCode, `${moduleName}.v1.json`),
      );
      const result = validateDossierModule(countryModule);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    const draftRoot = repoPath("data", "drafts", "countries", countryCode);
    for (const moduleName of await readdir(draftRoot).catch(() => [])) {
      for (const draftFile of (await readdir(repoPath("data", "drafts", "countries", countryCode, moduleName)).catch(() => [])).filter((file) => file.endsWith(".json"))) {
        const draft = await readJsonFile<NarrativeDraft>(repoPath("data", "drafts", "countries", countryCode, moduleName, draftFile));
        if (!draft.prompt_hash) errors.push(`${draft.draft_id}: draft lacks prompt_hash`);
        for (const claim of draft.claims) {
          if (!claim.review_status) errors.push(`${claim.claim_id}: draft claim lacks review_status`);
        }
      }
    }
  }
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`Error: ${error}`));
    process.exit(1);
  }
  console.log(`Dossier validation passed with ${warnings.length} warning(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
