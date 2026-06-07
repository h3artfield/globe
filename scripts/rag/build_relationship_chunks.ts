import type { RelationshipModule } from "@/types/pipeline";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_RELATIONSHIP_PAIRS, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import { buildRelationshipChunk } from "@/lib/pipeline/chunks";
import { readJsonFile, repoPath, writeJsonLinesFile } from "@/lib/pipeline/io";

async function main() {
  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const chunks = [];

    for (const [index, module] of RELATIONSHIP_MODULES.entries()) {
      const modulePath = repoPath(
        "data",
        "rag",
        "relationships",
        relationshipId,
        `${module}.v1.json`,
      );
      const payload = await readJsonFile<RelationshipModule>(modulePath);
      chunks.push(buildRelationshipChunk(payload, index + 1));
    }

    await writeJsonLinesFile(
      repoPath("data", "rag", "relationships", relationshipId, "chunks.jsonl"),
      chunks,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
