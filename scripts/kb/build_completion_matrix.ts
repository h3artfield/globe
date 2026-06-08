import {
  buildCountryRequirements,
  buildRelationshipRequirements,
  loadCountryModuleTemplate,
  loadRelationshipModuleTemplate,
  MISSING_COUNTRY_REQUIREMENTS,
  MISSING_RELATIONSHIP_REQUIREMENTS,
  validateCountryRequirements,
  validateRelationshipRequirements,
} from "@/lib/kb/requirementsFactory";
import type { CountrySourceRequirementsFile, RelationshipSourceRequirementsFile } from "@/types/kb";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { buildCompletionMatrix } from "@/lib/kb/completionMatrix";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

async function ensureRequirementFiles(): Promise<void> {
  await loadCountryModuleTemplate();
  await loadRelationshipModuleTemplate();

  for (const countryCode of MISSING_COUNTRY_REQUIREMENTS) {
    const filePath = repoPath(
      "data",
      "source_requirements",
      "countries",
      countryCode + ".source_requirements.v1.json",
    );
    if (!(await pathExists(filePath))) {
      await writeJsonFile(filePath, buildCountryRequirements(countryCode));
    }
  }

  for (const relationshipId of MISSING_RELATIONSHIP_REQUIREMENTS) {
    const filePath = repoPath(
      "data",
      "source_requirements",
      "relationships",
      relationshipId + ".source_requirements.v1.json",
    );
    if (!(await pathExists(filePath))) {
      await writeJsonFile(filePath, buildRelationshipRequirements(relationshipId));
    }
  }
}

async function validateAllRequirements(): Promise<void> {
  const errors: string[] = [];
  for (const countryCode of MVP_COUNTRIES) {
    const filePath = repoPath(
      "data",
      "source_requirements",
      "countries",
      countryCode + ".source_requirements.v1.json",
    );
    const file = await readJsonFile<CountrySourceRequirementsFile>(filePath);
    errors.push(...validateCountryRequirements(file));
  }
  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const filePath = repoPath(
      "data",
      "source_requirements",
      "relationships",
      relationshipId + ".source_requirements.v1.json",
    );
    const file = await readJsonFile<RelationshipSourceRequirementsFile>(filePath);
    errors.push(...validateRelationshipRequirements(file));
  }
  if (errors.length > 0) {
    throw new Error("Invalid source requirements:\n" + errors.join("\n"));
  }
}

async function main() {
  await ensureRequirementFiles();
  await validateAllRequirements();
  const matrix = await buildCompletionMatrix();
  const outPath = repoPath("data", "reports", "kb_completion_matrix.v1.json");
  await writeJsonFile(outPath, matrix);
  console.log("Wrote " + outPath);
  console.log(
    JSON.stringify(
      {
        countries: Object.fromEntries(
          Object.entries(matrix.countries).map(([id, entry]) => [id, entry.readiness_score]),
        ),
        relationships: Object.fromEntries(
          Object.entries(matrix.relationships).map(([id, entry]) => [id, entry.readiness_score]),
        ),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
