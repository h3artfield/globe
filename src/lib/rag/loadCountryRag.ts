import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IsoAlpha3Code } from "@/types/country";
import type { LoadedCountryRag } from "@/types/rag";
import { normalizeCountryCode } from "@/lib/globe/countryIdMap";
import { validateCountryRag } from "./validateCountryRag";

export function getCountryProfilePath(countryCode: IsoAlpha3Code): string {
  return `/data/rag/countries/${normalizeCountryCode(countryCode)}/profile.v1.json`;
}

function getCountryProfileFilesystemPath(countryCode: IsoAlpha3Code): string {
  return path.join(
    process.cwd(),
    "data",
    "rag",
    "countries",
    normalizeCountryCode(countryCode),
    "profile.v1.json",
  );
}

export async function loadCountryRag(countryCode: IsoAlpha3Code): Promise<LoadedCountryRag> {
  const normalizedCode = normalizeCountryCode(countryCode);
  const publicPath = getCountryProfilePath(normalizedCode);

  try {
    const rawProfile = await readFile(getCountryProfileFilesystemPath(normalizedCode), "utf8");
    const parsedProfile = JSON.parse(rawProfile) as unknown;

    if (!validateCountryRag(parsedProfile)) {
      return {
        countryCode: normalizedCode,
        exists: false,
        path: publicPath,
        error: "Country profile exists but does not match the expected schema.",
      };
    }

    return {
      countryCode: normalizedCode,
      exists: true,
      path: publicPath,
      data: parsedProfile,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown file loading error.";

    return {
      countryCode: normalizedCode,
      exists: false,
      path: publicPath,
      error: message.includes("ENOENT") ? "Country profile file is missing." : message,
    };
  }
}
