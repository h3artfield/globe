import { getSourceAdapter } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  const adapter = getSourceAdapter("unesco_uis");

  if (!adapter) {
    throw new Error("Missing source adapter: unesco_uis");
  }

  await runSourceAdapter(adapter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
