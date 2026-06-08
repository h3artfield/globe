import { mapToIso3 } from "@/lib/sources/countryCodeMapper";

const COW_CCODE_TO_ISO3: Record<string, string> = {
  "2": "USA",
  "710": "CHN",
  "651": "EGY",
  "530": "ETH",
  "365": "RUS",
  "369": "UKR",
  "750": "IND",
  "770": "PAK",
  "666": "ISR",
  "630": "IRN",
  "670": "SAU",
  "640": "TUR",
};

export function cowCcodeToIso3(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromCcode = COW_CCODE_TO_ISO3[trimmed];
  if (fromCcode) {
    return fromCcode;
  }

  return mapToIso3(trimmed);
}
