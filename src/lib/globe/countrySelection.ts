import type { CountrySummary, IsoAlpha3Code } from "@/types/country";
import { normalizeCountryCode } from "./countryIdMap";

export function toggleCountrySelection(
  selectedCountries: CountrySummary[],
  country: CountrySummary,
): CountrySummary[] {
  const normalizedCode = normalizeCountryCode(country.code);
  const exists = selectedCountries.some((selected) => selected.code === normalizedCode);

  if (exists) {
    return selectedCountries.filter((selected) => selected.code !== normalizedCode);
  }

  return [...selectedCountries, { ...country, code: normalizedCode }];
}

export function removeCountrySelection(
  selectedCountries: CountrySummary[],
  countryCode: IsoAlpha3Code,
): CountrySummary[] {
  const normalizedCode = normalizeCountryCode(countryCode);
  return selectedCountries.filter((selected) => selected.code !== normalizedCode);
}
