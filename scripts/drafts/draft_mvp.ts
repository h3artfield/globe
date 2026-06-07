import { MVP_COUNTRIES } from "@/lib/pipeline/constants";
import { generateNarrativeDraftForModule } from "@/lib/dossier/narrativeDraftGenerator";

const PRIORITY_MODULES = [
  "leader_dossiers",
  "ruling_class",
  "allies_and_partners",
  "adversaries_and_rivals",
  "top_national_events_20_years",
  "news_memory",
  "national_event_timeline",
  "foreign_policy",
  "game_theory_profile",
  "history",
  "founding_groups",
  "religion_history",
  "population_divisions",
  "nationalism_cohesion",
  "national_cohesion_by_demographic",
  "adversary_narratives",
];

async function main() {
  for (const countryCode of MVP_COUNTRIES) {
    for (const moduleName of PRIORITY_MODULES) {
      await generateNarrativeDraftForModule(countryCode, moduleName);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
