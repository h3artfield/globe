import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { repoPath } from "@/lib/pipeline/io";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const WIPO_SOURCE_URL = "https://www.wipo.int/ipstats/en/";
const WIPO_SOURCE_NAME = "WIPO";
const PATENT_FAMILY_METRIC_ID = "patent_families_by_origin";
const PATENT_FAMILY_UNIT = "families";

type WipoParsedRow = {
  originName: string;
  originCode: string;
  office: string;
  year: string;
  value: string;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes) {
        const next = line[index + 1];
        if (next === '"') {
          const after = line[index + 2];
          if (after === "," || after === undefined) {
            inQuotes = false;
            index += 1;
            continue;
          }
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        inQuotes = true;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function isNumericObservation(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function isYearHeader(header: string): boolean {
  return /^\d{4}$/.test(header.trim());
}

export function parseWipoWideExport(content: string): WipoParsedRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerIndex = lines.findIndex((line) => line.startsWith("Origin,"));
  if (headerIndex < 0) {
    return [];
  }

  const headers = parseCsvLine(lines[headerIndex]);
  const yearColumns = headers
    .map((header, index) => ({ header: header.trim(), index }))
    .filter((entry) => isYearHeader(entry.header));

  const rows: WipoParsedRow[] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = parseCsvLine(line);
    const originName = cells[0] ?? "";
    const originCode = cells[1] ?? "";
    const office = cells[2] ?? "";
    if (!originName && !originCode) {
      continue;
    }

    for (const { header, index } of yearColumns) {
      const value = (cells[index] ?? "").trim();
      if (!isNumericObservation(value)) {
        continue;
      }
      rows.push({
        originName,
        originCode,
        office,
        year: header,
        value,
      });
    }
  }

  return rows;
}

export async function readWipoRawRecords(
  rawFiles: string[],
): Promise<{ records: ManualRecord[]; filesRead: string[] }> {
  const records: ManualRecord[] = [];
  const filesRead: string[] = [];

  for (const filePath of rawFiles) {
    const content = await readFile(filePath, "utf8");
    const parsed = parseWipoWideExport(content);
    if (parsed.length === 0) {
      continue;
    }

    filesRead.push(path.relative(repoPath(), filePath).replace(/\\/g, "/"));
    for (const row of parsed) {
      records.push({
        origin: row.originName,
        origin_code: row.originCode,
        office: row.office,
        year: row.year,
        value: row.value,
      });
    }
  }

  return { records, filesRead };
}

function buildRawRecordId(countryCode: string, year: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, PATENT_FAMILY_METRIC_ID, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function transformRow(
  record: ManualRecord,
  skipReasons: TransformStats["skipReasons"],
): CanonicalMetricRow | null {
  const office = getField(record, ["office"]);
  if (office.toLowerCase() !== "total") {
    incrementSkip(skipReasons, "unmapped_metric_column");
    return null;
  }

  const originCode = getField(record, ["origin_code", "origin (code)", "country_code"]);
  const originName = getField(record, ["origin", "country", "country_name"]);
  const countryCode = resolveMvpCountry(originCode || originName);

  if (!originCode && !originName) {
    incrementSkip(skipReasons, "missing_country");
    return null;
  }
  if (!countryCode) {
    incrementSkip(skipReasons, "non_mvp_country");
    return null;
  }

  const year = getField(record, ["year", "time_period"]);
  if (!year) {
    incrementSkip(skipReasons, "missing_required_field");
    return null;
  }

  const value = getField(record, ["value", "obs_value", "metric_value"]);
  if (!isNumericObservation(value)) {
    incrementSkip(skipReasons, "empty_value");
    return null;
  }

  return {
    country_code: countryCode,
    year,
    metric_id: PATENT_FAMILY_METRIC_ID,
    value,
    unit: PATENT_FAMILY_UNIT,
    source_url: WIPO_SOURCE_URL,
    source_name: WIPO_SOURCE_NAME,
    raw_record_id: buildRawRecordId(countryCode, year, value),
    calculation: "",
    notes: "wipo_indicator=6a-Patent family by origin",
  };
}

function dedupeMetricRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  const byKey = new Map<string, CanonicalMetricRow>();
  for (const row of rows) {
    byKey.set(row.country_code + ":" + row.year + ":" + row.metric_id, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) return country;
    const year = a.year.localeCompare(b.year);
    if (year !== 0) return year;
    return a.metric_id.localeCompare(b.metric_id);
  });
}

export function transformWipo(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalMetricRow[] = [];

  for (const record of records) {
    const row = transformRow(record, skipReasons);
    if (row) {
      rows.push(row);
    }
  }

  const deduped = dedupeMetricRows(rows);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "wipo",
      rawFilesRead,
      rowsRead: records.length,
      rowsWritten: deduped.length,
      rowsSkipped: skipped,
      skipReasons,
      outputPath,
      implemented: true,
    },
  };
}
