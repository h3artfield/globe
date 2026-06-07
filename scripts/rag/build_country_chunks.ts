import type { CountryModule } from "@/types/pipeline";
import { COUNTRY_MODULES, MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { buildCountryChunk } from "@/lib/pipeline/chunks";
import { readJsonFile, repoPath, writeJsonLinesFile } from "@/lib/pipeline/io";

async function main() {
  for (const countryCode of MVP_COUNTRIES) {
    const chunks = [];

    for (const [index, module] of COUNTRY_MODULES.entries()) {
      const modulePath = repoPath("data", "rag", "countries", countryCode, `${module}.v1.json`);
      const payload = await readJsonFile<CountryModule>(modulePath);
      chunks.push(buildCountryChunk(payload, index + 1));
    }

    await writeJsonLinesFile(repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"), chunks);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
