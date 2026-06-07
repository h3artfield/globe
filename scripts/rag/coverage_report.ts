import type { CountryModule, IndicatorRegistryEntry, RelationshipModule } from "@/types/pipeline";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { COUNTRY_MODULES, MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS, RELATIONSHIP_MODULES } from "@/lib/pipeline/constants";
import { buildCountryCoverageReport, buildRelationshipCoverageReport } from "@/lib/pipeline/coverage";
import { readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

type IndicatorRegistryFile = {
  indicators: IndicatorRegistryEntry[];
};

async function main() {
  const registry = await readJsonFile<IndicatorRegistryFile>(
    repoPath("data", "sources", "indicator_registry.v1.json"),
  );

  for (const countryCode of MVP_COUNTRIES) {
    const modules = await Promise.all(
      COUNTRY_MODULES.map((module) =>
        readJsonFile<CountryModule>(
          repoPath("data", "rag", "countries", countryCode, `${module}.v1.json`),
        ),
      ),
    );

    await writeJsonFile(
      repoPath("data", "rag", "countries", countryCode, "coverage_report.v1.json"),
      buildCountryCoverageReport(countryCode, modules, registry.indicators),
    );
  }

  for (const pair of MVP_RELATIONSHIP_PAIRS) {
    const relationshipId = buildRelationshipId(pair[0], pair[1]);
    const modules = await Promise.all(
      RELATIONSHIP_MODULES.map((module) =>
        readJsonFile<RelationshipModule>(
          repoPath("data", "rag", "relationships", relationshipId, `${module}.v1.json`),
        ),
      ),
    );

    await writeJsonFile(
      repoPath("data", "rag", "relationships", relationshipId, "coverage_report.v1.json"),
      buildRelationshipCoverageReport(relationshipId, modules),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
