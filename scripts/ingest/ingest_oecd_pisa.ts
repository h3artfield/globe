import { getSourceAdapter } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  const adapter = getSourceAdapter("oecd_pisa");

  if (!adapter) {
    throw new Error("Missing source adapter: oecd_pisa");
  }

  await runSourceAdapter(adapter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
