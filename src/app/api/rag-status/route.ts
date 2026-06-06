import { NextResponse } from "next/server";
import type { RagStatusRequest, RagStatusResponse } from "@/types/api";
import { buildCountryPairs, normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { getCountryProfilePath, loadCountryRag } from "@/lib/rag/loadCountryRag";
import {
  getRelationshipProfilePath,
  loadRelationshipRag,
} from "@/lib/rag/loadRelationshipRag";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RagStatusRequest>;
  const selectedCountries = Array.isArray(body.selectedCountries)
    ? Array.from(new Set(body.selectedCountries.map(normalizeCountryCode))).sort()
    : [];

  const countryProfiles = await Promise.all(selectedCountries.map(loadCountryRag));
  const relationshipProfiles = await Promise.all(
    buildCountryPairs(selectedCountries).map(([countryA, countryB]) =>
      loadRelationshipRag(countryA, countryB),
    ),
  );

  const response: RagStatusResponse = {
    countries: countryProfiles.map((profile) => ({
      code: profile.countryCode,
      name: profile.exists ? profile.data.country_name : undefined,
      countryProfilePath: getCountryProfilePath(profile.countryCode),
      hasCountryRag: profile.exists,
    })),
    relationships: relationshipProfiles.map((profile) => ({
      relationshipId: profile.relationshipId,
      countries: profile.countries,
      relationshipProfilePath: getRelationshipProfilePath(
        profile.countries[0],
        profile.countries[1],
      ),
      hasRelationshipRag: profile.exists,
    })),
  };

  return NextResponse.json(response);
}
