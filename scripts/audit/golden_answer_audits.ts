import { POST as askPost } from "@/app/api/ask/route";
import { readJsonFile, repoPath } from "@/lib/pipeline/io";

async function ask(question: string, selectedCountries: string[]) {
  await askPost(new Request("http://localhost/api/ask", {
    method: "POST",
    body: JSON.stringify({ question, selectedCountries, mode: "strategic", debug: true, saveAudit: true }),
  }));
}

async function main() {
  const usa = await readJsonFile<{ items: string[] }>(repoPath("data", "eval", "golden_country_eval_USA.v1.json"));
  const rel = await readJsonFile<{ items: string[]; selectedCountries: string[] }>(repoPath("data", "eval", "golden_relationship_eval_EGY_ETH.v1.json"));
  for (const question of usa.items) await ask(question, ["USA"]);
  for (const question of rel.items) await ask(question, rel.selectedCountries);
}

main().catch((error) => { console.error(error); process.exit(1); });
