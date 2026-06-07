import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  const moduleName = process.argv[3];
  if (!moduleName) throw new Error("Usage: npm run dossier:build:module -- USA leader_dossiers");
  const report = await buildCountryDossier(countryCode, [moduleName]);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
