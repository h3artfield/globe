import { buildPilotReadiness } from "@/lib/pilot/readiness";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  console.log(JSON.stringify(await buildPilotReadiness(countryCode, "country"), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
