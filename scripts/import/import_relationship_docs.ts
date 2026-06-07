import { importRelationshipDocuments } from "@/lib/pilot/documentImporter";

async function main() {
  const relationshipId = process.argv[2];
  if (!relationshipId) throw new Error("Usage: npm run sources:import-docs:relationship -- EGY_ETH");
  console.log(`Imported ${await importRelationshipDocuments(relationshipId)} relationship document chunk(s).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
