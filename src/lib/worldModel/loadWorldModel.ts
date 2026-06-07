import type { CountryModule, RelationshipModule } from "@/types/pipeline";
import type { RelationshipGraph } from "@/types/worldModel";
import { normalizeCountryCode, buildRelationshipId } from "@/lib/globe/countryIdMap";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

export async function loadCountryWorldModule(
  countryCode: string,
  moduleName: string,
): Promise<CountryModule | null> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath("data", "rag", "countries", normalizedCode, `${moduleName}.v1.json`);
  return (await pathExists(filePath)) ? readJsonFile<CountryModule>(filePath) : null;
}

export async function loadCountryWorldEvents(countryCode: string) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "countries",
    normalizedCode,
    "national_event_timeline.v1.json",
  );
  return (await pathExists(filePath)) ? readJsonFile<unknown>(filePath) : null;
}

export async function loadCountryTopEvents(countryCode: string) {
  const normalizedCode = normalizeCountryCode(countryCode);
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "countries",
    normalizedCode,
    "top_events_20_years.v1.json",
  );
  return (await pathExists(filePath)) ? readJsonFile<unknown>(filePath) : null;
}

export async function loadRelationshipWorldEvents(relationshipId: string) {
  const [countryA, countryB] = relationshipId.split("_");
  const normalizedRelationshipId =
    countryA && countryB ? buildRelationshipId(countryA, countryB) : relationshipId.toUpperCase();
  const filePath = repoPath(
    "data",
    "world_model",
    "events",
    "relationships",
    normalizedRelationshipId,
    "relationship_event_timeline.v1.json",
  );
  return (await pathExists(filePath)) ? readJsonFile<unknown>(filePath) : null;
}

export async function loadRelationshipWorldModule(
  relationshipId: string,
  moduleName: string,
): Promise<RelationshipModule | null> {
  const [countryA, countryB] = relationshipId.split("_");
  const normalizedRelationshipId =
    countryA && countryB ? buildRelationshipId(countryA, countryB) : relationshipId.toUpperCase();
  const filePath = repoPath(
    "data",
    "rag",
    "relationships",
    normalizedRelationshipId,
    `${moduleName}.v1.json`,
  );
  return (await pathExists(filePath)) ? readJsonFile<RelationshipModule>(filePath) : null;
}

export async function loadWorldRelationshipGraph(): Promise<RelationshipGraph | null> {
  const filePath = repoPath("data", "world_model", "graphs", "country_relationship_graph.v1.json");
  return (await pathExists(filePath)) ? readJsonFile<RelationshipGraph>(filePath) : null;
}
