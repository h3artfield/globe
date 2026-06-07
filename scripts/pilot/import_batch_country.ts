import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { importCountryDocuments } from "@/lib/pilot/documentImporter";
import { createCountrySourcePack } from "@/lib/pilot/sourcePack";
import { buildCountrySourceGapReport } from "@/lib/pilot/sourceGaps";
import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";
import { generateNarrativeDraftForModule } from "@/lib/dossier/narrativeDraftGenerator";
import { buildCountryCompletionScore } from "@/lib/pilot/completionScore";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  await importCountryDocuments(countryCode);
  await createCountrySourcePack(countryCode);
  await buildCountrySourceGapReport(countryCode);
  await buildCountryDossier(countryCode);
  await generateNarrativeDraftForModule(countryCode, "leader_dossiers");
  await buildCountryCompletionScore(countryCode);
}

main().catch((error) => { console.error(error); process.exit(1); });
