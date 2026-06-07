import { getSourceAdapters } from "@/lib/sources/adapters";
import { loadSourceRegistry } from "@/lib/sources/sourceRegistryLoader";

async function main() {
  const registry = await loadSourceRegistry();
  const adapters = new Set(getSourceAdapters().map((adapter) => adapter.sourceId));

  for (const source of registry) {
    console.log(
      `${source.source_id}\tadapter=${adapters.has(source.source_id) ? "yes" : "no"}\tpriority=${source.priority}\t${source.name}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
