import { readJsonFile, repoPath } from "@/lib/pipeline/io";
import { buildRetrievalContext } from "@/lib/rag/buildRetrievalContext";

async function evaluateQuestion(question: string, selectedCountries: string[]) {
  const context = await buildRetrievalContext({ question, selectedCountries, mode: "strategic" });
  const failures: string[] = [];
  if (context.citations.length === 0 && context.retrievedChunks.some((chunk) => chunk.source_ids.length > 0)) failures.push("citations missing");
  if (context.missingData.length === 0) failures.push("missing data not acknowledged");
  if (context.retrievedChunks.some((chunk) => chunk.source_ids.includes("wikipedia")) && context.retrievedChunks[0]?.source_ids.includes("wikipedia")) failures.push("Wikipedia over-prioritized");
  return failures;
}

async function main() {
  const countryEval = await readJsonFile<{ items: string[] }>(repoPath("data", "eval", "golden_country_eval_USA.v1.json"));
  const relationshipEval = await readJsonFile<{ items: string[]; selectedCountries: string[] }>(repoPath("data", "eval", "golden_relationship_eval_EGY_ETH.v1.json"));
  const failures: string[] = [];
  for (const question of countryEval.items) {
    failures.push(...(await evaluateQuestion(question, ["USA"])).map((failure) => `USA: ${question}: ${failure}`));
  }
  for (const question of relationshipEval.items) {
    failures.push(...(await evaluateQuestion(question, relationshipEval.selectedCountries)).map((failure) => `EGY_ETH: ${question}: ${failure}`));
  }
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log("Golden eval passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
