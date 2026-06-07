import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { importRelationshipDocuments } from "@/lib/pilot/documentImporter";
import { createRelationshipSourcePack } from "@/lib/pilot/sourcePack";
import { buildRelationshipSourceGapReport } from "@/lib/pilot/sourceGaps";
import { buildRelationshipCompletionScore } from "@/lib/pilot/completionScore";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run sources:import-batch:relationship -- EGY_ETH");
  const [a, b] = input.split("_");
  const relationshipId = buildRelationshipId(a, b);
  await importRelationshipDocuments(relationshipId);
  await createRelationshipSourcePack(relationshipId);
  await buildRelationshipSourceGapReport(relationshipId);
  await buildRelationshipCompletionScore(relationshipId);
}

main().catch((error) => { console.error(error); process.exit(1); });
