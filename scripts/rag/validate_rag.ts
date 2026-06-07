import type { CountryModule, RagChunk, RelationshipModule } from "@/types/pipeline";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { COUNTRY_MODULES, MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import { readJsonFile, readJsonLinesFile, repoPath } from "@/lib/pipeline/io";
import { validateCountryModule, validateRagChunk, validateRelationshipModule } from "@/lib/pipeline/validation";

async function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const countryCode of MVP_COUNTRIES) {
    for (const module of COUNTRY_MODULES) {
      const location = `countries/${countryCode}/${module}.v1.json`;
      const payload = await readJsonFile<CountryModule>(
        repoPath("data", "rag", "countries", countryCode, `${module}.v1.json`),
      );
      const result = validateCountryModule(payload, location);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    const chunks = await readJsonLinesFile<RagChunk>(
      repoPath("data", "rag", "countries", countryCode, "chunks.jsonl"),
    );
    for (const [index, chunk] of chunks.entries()) {
      const result = validateRagChunk(chunk, `countries/${countryCode}/chunks.jsonl:${index + 1}`);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  }

  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);

    for (const module of RELATIONSHIP_MODULES) {
      const location = `relationships/${relationshipId}/${module}.v1.json`;
      const payload = await readJsonFile<RelationshipModule>(
        repoPath("data", "rag", "relationships", relationshipId, `${module}.v1.json`),
      );
      const result = validateRelationshipModule(payload, location);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    const chunks = await readJsonLinesFile<RagChunk>(
      repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl"),
    );
    for (const [index, chunk] of chunks.entries()) {
      const result = validateRagChunk(
        chunk,
        `relationships/${relationshipId}/chunks.jsonl:${index + 1}`,
      );
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  }

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  console.log(`RAG validation passed with ${warnings.length} warning(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
