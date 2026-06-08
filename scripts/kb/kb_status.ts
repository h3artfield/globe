import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";
import type { KbCompletionMatrix, KbCompletionQueue } from "@/types/kb";

async function main() {
  const matrixPath = repoPath("data", "reports", "kb_completion_matrix.v1.json");
  const queuePath = repoPath("data", "source_requests", "kb_completion_queue.v1.json");

  if (!(await pathExists(matrixPath))) {
    console.error("Matrix missing. Run: npm run kb:matrix");
    process.exit(1);
  }

  const matrix = await readJsonFile<KbCompletionMatrix>(matrixPath);
  const queue = (await pathExists(queuePath))
    ? await readJsonFile<KbCompletionQueue>(queuePath)
    : { version: "1.0" as const, generated_at: "", items: [] };

  console.log("KB Completion Status");
  console.log("==================");
  console.log(`Generated: ${matrix.generated_at}`);
  console.log(`Countries tracked: ${matrix.summary.countries_tracked}`);
  console.log(`Relationships tracked: ${matrix.summary.relationships_tracked}`);
  console.log(`Average country readiness: ${matrix.summary.average_country_readiness}`);
  console.log(`Average relationship readiness: ${matrix.summary.average_relationship_readiness}`);
  console.log(`Queue items needed: ${queue.items.filter((item) => item.collection_status === "needed").length}`);

  const batch1ManifestPath = repoPath(
    "data",
    "source_requests",
    "batch_1_shared_datasets_manifest.v1.json",
  );
  if (await pathExists(batch1ManifestPath)) {
    console.log(
      "Batch 1 collection manifest: data/source_requests/batch_1_shared_datasets_manifest.v1.json",
    );
    console.log("  Guide: data/source_requests/BATCH_1_SHARED_DATASETS.md");
    console.log("  Raw staging: data/manual_imports_raw/{source}/");
    console.log("  Transform: npm run kb:transform-batch1 -- --source <id>");
    console.log("  Receipts: npm run kb:receipts");
  }
  console.log("");

  console.log("Country readiness:");
  for (const [id, entry] of Object.entries(matrix.countries).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `  ${id}: ${entry.readiness_score.toFixed(2)} | complete=${entry.modules_complete} partial=${entry.modules_partial} missing=${entry.modules_missing} stub=${entry.modules_stub}`,
    );
  }

  console.log("");
  console.log("Relationship readiness:");
  for (const [id, entry] of Object.entries(matrix.relationships).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(
      `  ${id}: ${entry.readiness_score.toFixed(2)} | complete=${entry.modules_complete} partial=${entry.modules_partial} missing=${entry.modules_missing} stub=${entry.modules_stub}`,
    );
  }

  console.log("");
  console.log("Top 20 queue items by priority:");
  const top = [...queue.items].sort((a, b) => b.priority - a.priority).slice(0, 20);
  for (const item of top) {
    const scope = item.shared_source_id ? `shared:${item.shared_source_id}` : `${item.target_id}/${item.module}`;
    console.log(
      `  [${item.priority}] ${item.queue_id} | ${scope} | ${item.collection_status} | ${item.source_title}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
