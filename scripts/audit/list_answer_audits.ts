import { readdir } from "node:fs/promises";
import { repoPath } from "@/lib/pipeline/io";

async function main() {
  const files = await readdir(repoPath("data", "audits", "answers")).catch(() => []);
  console.log(JSON.stringify(files.filter((file) => file.endsWith(".json")).sort(), null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
