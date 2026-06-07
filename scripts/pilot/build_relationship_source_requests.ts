import { buildRelationshipSourceGapReport, sourceRequestsFromGaps } from "@/lib/pilot/sourceGaps";
import { writeJsonFile, repoPath } from "@/lib/pipeline/io";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run source-requests:build:relationship -- EGY_ETH");
  const [a, b] = input.split("_");
  const relationshipId = buildRelationshipId(a, b);
  const report = await buildRelationshipSourceGapReport(relationshipId);
  const requests = sourceRequestsFromGaps(report);
  await writeJsonFile(repoPath("data", "source_requests", "relationships", relationshipId, "source_requests.v1.json"), { target_id: relationshipId, requests });
  console.log(JSON.stringify({ target_id: relationshipId, requests }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
