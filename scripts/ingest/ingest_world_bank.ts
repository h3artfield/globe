import { WorldBankAdapter } from "@/lib/sources/adapters/worldBankAdapter";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

async function main() {
  await runSourceAdapter(new WorldBankAdapter());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
