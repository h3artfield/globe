import { createCountrySourcePack } from "@/lib/pilot/sourcePack";
import { importCountryDocuments, importRelationshipDocuments } from "@/lib/pilot/documentImporter";
import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";
import { buildCountryCompletionScore, buildRelationshipCompletionScore } from "@/lib/pilot/completionScore";

async function main() {
  for (const countryCode of ["USA", "CHN"]) {
    await createCountrySourcePack(countryCode);
    await importCountryDocuments(countryCode);
    await buildCountryDossier(countryCode);
    await buildCountryCompletionScore(countryCode);
  }
  await importRelationshipDocuments("EGY_ETH");
  await buildRelationshipCompletionScore("EGY_ETH");
}

main().catch((error) => { console.error(error); process.exit(1); });
