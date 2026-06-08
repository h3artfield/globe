import { buildCompletionMatrix } from "@/lib/kb/completionMatrix";
import { buildCompletionQueue } from "@/lib/kb/completionQueue";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import type { KbCompletionMatrix } from "@/types/kb";

async function main() {
  const matrixPath = repoPath("data", "reports", "kb_completion_matrix.v1.json");
  const matrix = (await pathExists(matrixPath))
    ? await readJsonFile<KbCompletionMatrix>(matrixPath)
    : await buildCompletionMatrix();

  const queue = await buildCompletionQueue(matrix);
  await writeJsonFile(matrixPath, matrix);
  console.log(`Wrote data/source_requests/kb_completion_queue.v1.json (${queue.items.length} items)`);
  console.log(
    JSON.stringify(
      {
        needed: queue.items.filter((item) => item.collection_status === "needed").length,
        found: queue.items.filter((item) => item.collection_status === "found").length,
        imported: queue.items.filter((item) => item.collection_status === "imported").length,
        rejected: queue.items.filter((item) => item.collection_status === "rejected").length,
        shared_items: queue.items.filter((item) => item.shared_source_id).length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
