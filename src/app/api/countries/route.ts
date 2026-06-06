import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { CountryGeoJson, CountrySummary } from "@/types/country";
import {
  getCountryFeatureIso3,
  getCountryFeatureName,
} from "@/lib/globe/countryIdMap";
import { loadCountryRag } from "@/lib/rag/loadCountryRag";

export async function GET() {
  const geoJsonPath = path.join(process.cwd(), "public", "geo", "countries.geojson");
  const rawGeoJson = await readFile(geoJsonPath, "utf8");
  const geoJson = JSON.parse(rawGeoJson) as CountryGeoJson;

  const countries = geoJson.features
    .map((feature): Omit<CountrySummary, "hasCountryRag"> | null => {
      const iso3 = getCountryFeatureIso3(feature.properties, feature.id);

      if (!iso3) {
        return null;
      }

      return {
        code: iso3,
        name: getCountryFeatureName(feature.properties, iso3),
      };
    })
    .filter((country): country is Omit<CountrySummary, "hasCountryRag"> => country !== null)
    .sort((countryA, countryB) => countryA.name.localeCompare(countryB.name));

  const statuses = await Promise.all(countries.map((country) => loadCountryRag(country.code)));
  const statusByCode = new Map(statuses.map((status) => [status.countryCode, status.exists]));

  return NextResponse.json(
    countries.map((country) => ({
      ...country,
      hasCountryRag: statusByCode.get(country.code) ?? false,
    })),
  );
}
