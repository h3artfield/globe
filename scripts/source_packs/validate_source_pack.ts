import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { validateSourcePack } from "@/lib/pilot/sourcePack";
import type { SourcePack } from "@/types/pilot";

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error("Usage: npm run source-pack:validate -- USA");
  const path = target.includes("_")
    ? repoPath("data", "source_packs", "relationships", `${target}.source_pack.v1.json`)
    : repoPath("data", "source_packs", "countries", `${target.toUpperCase()}.source_pack.v1.json`);
  const errors = validateSourcePack(await readJsonFile<SourcePack>(path));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log("Source pack validation passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
