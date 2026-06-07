import { COUNTRY_MODULES, MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import type { CountryModule } from "@/types/pipeline";
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
