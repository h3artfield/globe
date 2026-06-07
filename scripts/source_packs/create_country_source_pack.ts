import { createCountrySourcePack } from "@/lib/pilot/sourcePack";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  console.log(JSON.stringify(await createCountrySourcePack(countryCode), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
