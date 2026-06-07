import { getSourceAdapters } from "@/lib/sources/adapters";
import { runSourceAdapter } from "@/lib/sources/sourceRunner";

const MVP_SOURCE_IDS = [
  "world_bank_wdi",
  "un_comtrade",
  "unodc",
  "un_desa_migrant_stock",
  "vdem",
  "world_values_survey",
  "wipo",
  "unesco_uis",
  "oecd_pisa",
  "unctad",
];

async function main() {
  const adapters = getSourceAdapters().filter((adapter) => MVP_SOURCE_IDS.includes(adapter.sourceId));

  for (const adapter of adapters) {
    console.log(`Ingesting ${adapter.sourceId}`);
    await runSourceAdapter(adapter);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
