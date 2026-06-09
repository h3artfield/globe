import path from "node:path";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";

export type ProcessedMetricRow = {
  metric_id: string;
  country_code: string;
  value: number;
  unit: string;
  year: number;
  source_id: string;
  source_name: string;
  raw_record_id: string;
  notes: string;
};

type CountryMetricsFile = {
  country_code: string;
  metrics: ProcessedMetricRow[];
};

export function countryMetricsPath(countryCode: string): string {
  return repoPath("data", "processed", "countries", countryCode, "metrics.v1.json");
}

export async function loadCountryMetrics(
  countryCode: string,
): Promise<{ metrics: ProcessedMetricRow[]; filePath: string } | null> {
  const filePath = countryMetricsPath(countryCode);
  if (!(await pathExists(filePath))) {
    return null;
  }
  const payload = await readJsonFile<CountryMetricsFile>(filePath);
  return {
    metrics: payload.metrics ?? [],
    filePath: path.relative(process.cwd(), filePath).replaceAll("\\", "/"),
  };
}

export function parseMetricNotes(notes: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const part of notes.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    parsed[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return parsed;
}
