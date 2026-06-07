import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { generateNarrativeDraftForModule } from "@/lib/dossier/narrativeDraftGenerator";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  const moduleName = process.argv[3];
  if (!moduleName) throw new Error("Usage: npm run draft:module -- USA leader_dossiers");
  console.log(JSON.stringify(await generateNarrativeDraftForModule(countryCode, moduleName), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
