import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { buildCountryDossier } from "@/lib/dossier/dossierGenerator";

async function main() {
  for (const countryCode of MVP_COUNTRIES) {
    console.log(`Building dossier for ${countryCode}`);
    await buildCountryDossier(countryCode);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
