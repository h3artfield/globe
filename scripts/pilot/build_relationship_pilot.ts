import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { createRelationshipSourcePack } from "@/lib/pilot/sourcePack";
import { importRelationshipDocuments } from "@/lib/pilot/documentImporter";
import { buildRelationshipCompletionScore } from "@/lib/pilot/completionScore";

async function main() {
  const relationshipInput = process.argv[2];
  if (!relationshipInput) throw new Error("Usage: npm run pilot:build:relationship -- EGY_ETH");
  const [a, b] = relationshipInput.split("_");
  const relationshipId = buildRelationshipId(a, b);
  await createRelationshipSourcePack(relationshipId);
  await importRelationshipDocuments(relationshipId);
  console.log(JSON.stringify(await buildRelationshipCompletionScore(relationshipId), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
