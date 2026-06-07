import { importCountryDocuments } from "@/lib/pilot/documentImporter";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  console.log(`Imported ${await importCountryDocuments(countryCode)} country document chunk(s).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
