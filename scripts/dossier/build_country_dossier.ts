import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  const report = await buildCountryDossier(countryCode);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
