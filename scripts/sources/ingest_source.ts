import { getSourceAdapter } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  const sourceId = process.argv[2];

  if (!sourceId) {
    throw new Error("Usage: npm run source:ingest -- un_comtrade");
  }

  const adapter = getSourceAdapter(sourceId);

  if (!adapter) {
    throw new Error(`No adapter registered for source: ${sourceId}`);
  }

  await runSourceAdapter(adapter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
