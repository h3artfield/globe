import { readdir } from "node:fs/promises";
import { assertIso3 } from "@/lib/sources/countryCodeMapper";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

async function main() {
  const countryCode = assertIso3(process.argv[2] ?? "");
  const dir = repoPath("data", "reports", "dossier_builds", countryCode);
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`No dossier reports for ${countryCode}`);
  const latest = files[files.length - 1];
  console.log(JSON.stringify(await readJsonFile(repoPath("data", "reports", "dossier_builds", countryCode, latest)), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
