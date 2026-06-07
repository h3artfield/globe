import { buildCountrySourceGapReport, sourceRequestsFromGaps } from "@/lib/pilot/sourceGaps";
import { writeJsonFile, repoPath } from "@/lib/pipeline/io";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  const report = await buildCountrySourceGapReport(countryCode);
  const requests = sourceRequestsFromGaps(report);
  await writeJsonFile(repoPath("data", "source_requests", "countries", countryCode, "source_requests.v1.json"), { target_id: countryCode, requests });
  console.log(JSON.stringify({ target_id: countryCode, requests }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
