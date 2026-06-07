import { normalizeCountryCode } from "@/lib/globe/countryIdMap";

const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA",
  CN: "CHN",
  EG: "EGY",
  ET: "ETH",
  RU: "RUS",
  UA: "UKR",
  IN: "IND",
  PK: "PAK",
  IL: "ISR",
  IR: "IRN",
  SA: "SAU",
  TR: "TUR",
  WLD: "WLD",
};

export function mapToIso3(countryCode: string): string | null {
  const normalizedCode = normalizeCountryCode(countryCode);

  if (/^[A-Z]{3}$/.test(normalizedCode)) {
    return normalizedCode;
  }

  return ISO2_TO_ISO3[normalizedCode] ?? null;
}

export function assertIso3(countryCode: string): string {
  const iso3 = mapToIso3(countryCode);

  if (!iso3 || !/^[A-Z]{3}$/.test(iso3)) {
    throw new Error(`Invalid ISO Alpha-3 country code: ${countryCode}`);
  }

  return iso3;
}
