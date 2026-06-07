import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { buildPilotReadiness } from "@/lib/pilot/readiness";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run pilot:readiness:relationship -- EGY_ETH");
  const [a, b] = input.split("_");
  console.log(JSON.stringify(await buildPilotReadiness(buildRelationshipId(a, b), "relationship"), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
