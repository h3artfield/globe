import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IsoAlpha3Code } from "@/types/country";
import type { LoadedRelationshipRag } from "@/types/rag";
import { buildRelationshipId, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { validateRelationshipRag } from "./validateRelationshipRag";

export function getRelationshipProfilePath(
  countryA: IsoAlpha3Code,
  countryB: IsoAlpha3Code,
): string {
  const relationshipId = buildRelationshipId(countryA, countryB);
  return `/data/rag/relationships/${relationshipId}/relationship.v1.json`;
}

function getRelationshipProfileFilesystemPath(
  countryA: IsoAlpha3Code,
  countryB: IsoAlpha3Code,
): string {
  return path.join(
    process.cwd(),
    "data",
    "rag",
    "relationships",
    buildRelationshipId(countryA, countryB),
    "relationship.v1.json",
  );
}

export async function loadRelationshipRag(
  countryA: IsoAlpha3Code,
  countryB: IsoAlpha3Code,
): Promise<LoadedRelationshipRag> {
  const countries = [normalizeCountryCode(countryA), normalizeCountryCode(countryB)].sort() as [
    IsoAlpha3Code,
    IsoAlpha3Code,
  ];
  const relationshipId = buildRelationshipId(countries[0], countries[1]);
  const publicPath = getRelationshipProfilePath(countries[0], countries[1]);

  try {
    const rawProfile = await readFile(
      getRelationshipProfileFilesystemPath(countries[0], countries[1]),
      "utf8",
    );
    const parsedProfile = JSON.parse(rawProfile) as unknown;

    if (!validateRelationshipRag(parsedProfile)) {
      return {
        relationshipId,
        countries,
        exists: false,
        path: publicPath,
        error: "Relationship profile exists but does not match the expected schema.",
      };
    }

    return {
      relationshipId,
      countries,
      exists: true,
      path: publicPath,
      data: parsedProfile,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown file loading error.";

    return {
      relationshipId,
      countries,
      exists: false,
      path: publicPath,
      error: message.includes("ENOENT") ? "Relationship profile file is missing." : message,
    };
  }
}
