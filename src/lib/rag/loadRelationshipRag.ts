import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IsoAlpha3Code } from "@/types/country";
import type { LoadedRelationshipRag } from "@/types/rag";
import type { RelationshipProfile } from "@/types/relationship";
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
  const module = value as
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
    !module?.relationship_id ||
    !Array.isArray(module.countries) ||
    module.countries.length !== 2 ||
    !module.module
  ) {
    return null;
  }

  return {
    relationship_id: module.relationship_id,
    countries: module.countries as [string, string],
    version: module.version ?? "1.0",
    last_updated: module.last_updated ?? new Date().toISOString().slice(0, 10),
    sections: {
      [module.module]: {
        summary: module.summary ?? "",
        key_findings: module.key_findings ?? [],
        metrics: module.metrics ?? [],
        claims: module.claims ?? [],
      },
    },
    source_notes: ["Loaded from pipeline relationship module format."],
    confidence: {
      overall:
        module.confidence?.overall === "low" ||
        module.confidence?.overall === "medium" ||
        module.confidence?.overall === "high" ||
        module.confidence?.overall === "unknown"
          ? module.confidence.overall
          : "unknown",
      weak_sections: module.confidence?.weak_areas ?? [],
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
