import { getSourceAdapter } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  const adapter = getSourceAdapter("world_values_survey");

  if (!adapter) {
    throw new Error("Missing source adapter: world_values_survey");
  }

  await runSourceAdapter(adapter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
