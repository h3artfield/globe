import { createRelationshipSourcePack } from "@/lib/pilot/sourcePack";

async function main() {
  const relationshipId = process.argv[2];
  if (!relationshipId) throw new Error("Usage: npm run source-pack:create-relationship -- EGY_ETH");
  console.log(JSON.stringify(await createRelationshipSourcePack(relationshipId), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
