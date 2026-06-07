import { buildRelationshipSourceGapReport } from "@/lib/pilot/sourceGaps";

async function main() {
  const relationshipId = process.argv[2];
  if (!relationshipId) throw new Error("Usage: npm run source-gaps:relationship -- EGY_ETH");
  console.log(JSON.stringify(await buildRelationshipSourceGapReport(relationshipId), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
