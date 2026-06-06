import type { IsoAlpha3Code } from "@/types/country";

export function normalizeCountryCode(value: string): IsoAlpha3Code {
  return value.trim().toUpperCase();
}

export function getCountryFeatureIso3(
  properties: Record<string, unknown> | null | undefined,
  fallbackId?: string | number,
): IsoAlpha3Code | null {
  const candidates = [
    properties?.iso3,
    properties?.ISO_A3,
    properties?.ADM0_A3,
    properties?.id,
    fallbackId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^[A-Za-z]{3}$/.test(candidate)) {
      return normalizeCountryCode(candidate);
    }
  }

  return null;
}

export function getCountryFeatureName(
  properties: Record<string, unknown> | null | undefined,
  fallbackCode: IsoAlpha3Code,
): string {
  const candidates = [properties?.name, properties?.NAME, properties?.ADMIN];
  const name = candidates.find((candidate) => typeof candidate === "string");
  return typeof name === "string" ? name : fallbackCode;
}

export function buildRelationshipId(
  countryA: IsoAlpha3Code,
  countryB: IsoAlpha3Code,
): `${string}_${string}` {
  const [first, second] = [normalizeCountryCode(countryA), normalizeCountryCode(countryB)].sort();
  return `${first}_${second}`;
}

export function buildCountryPairs(
  countries: IsoAlpha3Code[],
): [IsoAlpha3Code, IsoAlpha3Code][] {
  const uniqueCountries = Array.from(new Set(countries.map(normalizeCountryCode))).sort();
  const pairs: [IsoAlpha3Code, IsoAlpha3Code][] = [];

  for (let i = 0; i < uniqueCountries.length; i += 1) {
    for (let j = i + 1; j < uniqueCountries.length; j += 1) {
      pairs.push([uniqueCountries[i], uniqueCountries[j]]);
    }
  }

  return pairs;
}
