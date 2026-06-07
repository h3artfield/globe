import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IsoAlpha3Code } from "@/types/country";
import type { LoadedRelationshipRag } from "@/types/rag";
import type { RelationshipId, RelationshipProfile } from "@/types/relationship";
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

function convertRelationshipModuleToProfile(value: unknown): RelationshipProfile | null {
  const relationshipModule = value as
    | {
        relationship_id?: string;
        countries?: string[];
        module?: string;
        version?: string;
        last_updated?: string;
        summary?: string;
        key_findings?: string[];
        metrics?: unknown[];
        claims?: unknown[];
        confidence?: { overall?: string; weak_areas?: string[] };
      }
    | undefined;

  if (
    !relationshipModule?.relationship_id ||
    !Array.isArray(relationshipModule.countries) ||
    relationshipModule.countries.length !== 2 ||
    !relationshipModule.module
  ) {
    return null;
  }

  return {
    relationship_id: relationshipModule.relationship_id as RelationshipId,
    countries: relationshipModule.countries as [string, string],
    version: relationshipModule.version ?? "1.0",
    last_updated: relationshipModule.last_updated ?? new Date().toISOString().slice(0, 10),
    sections: {
      [relationshipModule.module]: {
        summary: relationshipModule.summary ?? "",
        key_findings: relationshipModule.key_findings ?? [],
        metrics: relationshipModule.metrics ?? [],
        claims: relationshipModule.claims ?? [],
      },
    },
    source_notes: ["Loaded from pipeline relationship module format."],
    confidence: {
      overall:
        relationshipModule.confidence?.overall === "low" ||
        relationshipModule.confidence?.overall === "medium" ||
        relationshipModule.confidence?.overall === "high" ||
        relationshipModule.confidence?.overall === "unknown"
          ? relationshipModule.confidence.overall
          : "unknown",
      weak_sections: relationshipModule.confidence?.weak_areas ?? [],
    },
  };
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

    const relationshipProfile = validateRelationshipRag(parsedProfile)
      ? parsedProfile
      : convertRelationshipModuleToProfile(parsedProfile);

    if (!relationshipProfile) {
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
      data: relationshipProfile,
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
