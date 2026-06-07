import { buildCountrySourceGapReport } from "@/lib/pilot/sourceGaps";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  console.log(JSON.stringify(await buildCountrySourceGapReport(countryCode), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
