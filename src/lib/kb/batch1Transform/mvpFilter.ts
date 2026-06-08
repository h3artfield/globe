import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { MVP_COUNTRIES, MVP_RELATIONSHIP_PAIRS } from "@/lib/pipeline/constants";
import { mapToIso3 } from "@/lib/sources/countryCodeMapper";

export const MVP_COUNTRY_SET = new Set<string>(MVP_COUNTRIES);

const MVP_RELATIONSHIP_SET = new Set<string>(
  MVP_RELATIONSHIP_PAIRS.map(([a, b]) => buildRelationshipId(a, b)),
);

export function resolveMvpCountry(raw: string): string | null {
  const iso3 = mapToIso3(raw);
  if (!iso3 || !MVP_COUNTRY_SET.has(iso3)) {
    return null;
  }
  return iso3;
}

export function resolveMvpCountries(rawValues: string[]): string[] {
  const codes = new Set<string>();
  for (const raw of rawValues) {
    const iso3 = resolveMvpCountry(raw);
    if (iso3) {
      codes.add(iso3);
    }
  }
  return [...codes].sort();
}

export function matchesMvpRelationship(countryCodes: string[]): boolean {
  if (countryCodes.length < 2) {
    return countryCodes.some((code) => MVP_COUNTRY_SET.has(code));
  }
  if (countryCodes.length === 2) {
    const relationshipId = buildRelationshipId(
      countryCodes[0] as (typeof MVP_COUNTRIES)[number],
      countryCodes[1] as (typeof MVP_COUNTRIES)[number],
    );
    return MVP_RELATIONSHIP_SET.has(relationshipId);
  }
  return countryCodes.some((code) => MVP_COUNTRY_SET.has(code));
}

export function incrementSkip(
  reasons: Partial<Record<string, number>>,
  reason: string,
): Partial<Record<string, number>> {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
  return reasons;
}
