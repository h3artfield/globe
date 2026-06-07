import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { createAllRelationshipModules } from "@/lib/pipeline/relationships";
import { repoPath, writeJsonFile } from "@/lib/pipeline/io";

async function main() {
  const generatedAt = new Date().toISOString();

  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const relationshipDirectory = repoPath("data", "rag", "relationships", relationshipId);
    const modules = createAllRelationshipModules(pair, generatedAt);

    for (const relationshipModule of modules) {
      await writeJsonFile(
        `${relationshipDirectory}/${relationshipModule.module}.v1.json`,
        relationshipModule,
      );
    }

    await writeJsonFile(`${relationshipDirectory}/sources.json`, {
      relationship_id: relationshipId,
      countries: relationshipId.split("_"),
      generated_at: generatedAt,
      source_ids: [],
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
