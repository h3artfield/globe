import type { CountryProfile } from "@/types/rag";

const ISO3_PATTERN = /^[A-Z]{3}$/;

export function validateCountryRag(value: unknown): value is CountryProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<CountryProfile>;

  return (
    typeof profile.country_code === "string" &&
    ISO3_PATTERN.test(profile.country_code) &&
    typeof profile.country_name === "string" &&
    typeof profile.version === "string" &&
    typeof profile.last_updated === "string" &&
    !!profile.sections &&
    typeof profile.sections === "object" &&
    Array.isArray(profile.source_notes) &&
    !!profile.confidence &&
    typeof profile.confidence === "object" &&
    typeof profile.confidence.overall === "string" &&
    Array.isArray(profile.confidence.weak_sections)
  );
}
