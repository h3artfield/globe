import type { CountryGeoJson } from "@/types/country";

export async function loadCountriesGeoJson(): Promise<CountryGeoJson> {
  const response = await fetch("/geo/countries.geojson");

  if (!response.ok) {
    throw new Error(`Failed to load country GeoJSON: ${response.status}`);
  }

  return (await response.json()) as CountryGeoJson;
}
