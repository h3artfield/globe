import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { createCountrySourcePack } from "@/lib/pilot/sourcePack";
import { importCountryDocuments } from "@/lib/pilot/documentImporter";
import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";
import { buildCountryCompletionScore } from "@/lib/pilot/completionScore";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  await importCountryDocuments(countryCode);
  await createCountrySourcePack(countryCode);
  await buildCountryDossier(countryCode);
  console.log(JSON.stringify(await buildCountryCompletionScore(countryCode), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
