import type { IsoAlpha3Code } from "@/types/country";
import type { RagContext } from "@/types/rag";
import { buildCountryPairs, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { loadCountryRag } from "./loadCountryRag";
import { loadRelationshipRag } from "./loadRelationshipRag";

export async function buildRagContext(selectedCountries: IsoAlpha3Code[]): Promise<RagContext> {
  const normalizedCountries = Array.from(
    new Set(selectedCountries.map(normalizeCountryCode).filter(Boolean)),
  ).sort();

  const countryProfiles = await Promise.all(normalizedCountries.map(loadCountryRag));
  const relationshipProfiles = await Promise.all(
    buildCountryPairs(normalizedCountries).map(([countryA, countryB]) =>
      loadRelationshipRag(countryA, countryB),
    ),
  );

  const missingCountryData = countryProfiles
    .filter((profile) => !profile.exists)
    .map((profile) => `${profile.countryCode}: ${profile.error ?? "Missing country profile."}`);

  const missingRelationshipData = relationshipProfiles
    .filter((profile) => !profile.exists)
    .map(
      (profile) =>
        `${profile.relationshipId}: ${profile.error ?? "Missing relationship profile."}`,
    );

  const countrySectionCount = countryProfiles.reduce(
    (count, profile) => count + (profile.exists ? Object.keys(profile.data.sections).length : 0),
    0,
  );
  const relationshipSectionCount = relationshipProfiles.reduce(
    (count, profile) => count + (profile.exists ? Object.keys(profile.data.sections).length : 0),
    0,
  );

  return {
    selectedCountries: normalizedCountries,
    countryProfiles,
    relationshipProfiles,
    missingData: [...missingCountryData, ...missingRelationshipData],
    plannedContextSize: {
      countryProfilesLoaded: countryProfiles.filter((profile) => profile.exists).length,
      relationshipProfilesLoaded: relationshipProfiles.filter((profile) => profile.exists).length,
      countrySectionCount,
      relationshipSectionCount,
    },
  };
}
