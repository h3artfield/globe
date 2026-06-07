import { getSourceAdapter } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  const adapter = getSourceAdapter("unctad");

  if (!adapter) {
    throw new Error("Missing source adapter: unctad");
  }

  await runSourceAdapter(adapter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
