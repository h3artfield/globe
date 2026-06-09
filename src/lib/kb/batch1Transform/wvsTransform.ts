import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { repoPath } from "@/lib/pipeline/io";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { TransformStats } from "./types";

const WVS_SOURCE_URL = "https://www.worldvaluessurvey.org/";
const WVS_SOURCE_NAME = "World Values Survey";
const WVS_UNIT = "score";

export const WVS_CANONICAL_HEADERS = [
  "country_code",
  "year",
  "metric_id",
  "value",
  "unit",
  "source_url",
  "source_name",
  "raw_record_id",
  "calculation",
  "notes",
  "sample_size",
  "question_wording",
  "response_mapping",
] as const;

export type WvsCanonicalRow = Record<(typeof WVS_CANONICAL_HEADERS)[number], string>;

type MetricAggregationMode = "mean" | "pct_yes" | "inverted_mean_1_4" | "inverted_mean_1_3";

type WvsMetricSpec = {
  metricId: string;
  column: string;
  mode: MetricAggregationMode;
  validValues?: number[];
  questionWording: string;
  responseMapping: string;
};

const INVALID_CODES = new Set([-1, -2, -3, -4, -5]);

const WVS_METRIC_SPECS: WvsMetricSpec[] = [
  {
    metricId: "national_pride_score",
    column: "Q254",
    mode: "mean",
    validValues: [1, 2, 3, 4],
    questionWording: "How proud are you to be of nationality of this country?",
    responseMapping: "1=very proud to 4=not at all proud; exclude 5=not nationality",
  },
  {
    metricId: "willingness_to_fight_score",
    column: "Q151",
    mode: "pct_yes",
    validValues: [1, 2],
    questionWording: "Would you be willing to fight for your country?",
    responseMapping: "1=yes 2=no; score=percent yes",
  },
  {
    metricId: "trust_government_score",
    column: "Q71",
    mode: "mean",
    validValues: [1, 2, 3, 4],
    questionWording: "Confidence: The Government",
    responseMapping: "1=great deal to 4=none at all",
  },
  {
    metricId: "trust_military_score",
    column: "Q65",
    mode: "mean",
    validValues: [1, 2, 3, 4],
    questionWording: "Confidence: Armed Forces",
    responseMapping: "1=great deal to 4=none at all",
  },
  {
    metricId: "trust_police_score",
    column: "Q69",
    mode: "mean",
    validValues: [1, 2, 3, 4],
    questionWording: "Confidence: The Police",
    responseMapping: "1=great deal to 4=none at all",
  },
  {
    metricId: "trust_courts_score",
    column: "Q70",
    mode: "mean",
    validValues: [1, 2, 3, 4],
    questionWording: "Confidence: Justice System/Courts",
    responseMapping: "1=great deal to 4=none at all",
  },
  {
    metricId: "social_trust_score",
    column: "Q57",
    mode: "pct_yes",
    validValues: [1, 2],
    questionWording: "Generally speaking, would you say that most people can be trusted?",
    responseMapping: "1=most people can be trusted 2=need to be very careful; score=percent trusting",
  },
  {
    metricId: "attachment_to_country_score",
    column: "Q257",
    mode: "inverted_mean_1_4",
    validValues: [1, 2, 3, 4],
    questionWording: "Feel close to your country",
    responseMapping: "1=very close to 4=not close at all; score=5-mean",
  },
  {
    metricId: "religious_identity_strength",
    column: "Q173",
    mode: "inverted_mean_1_3",
    validValues: [1, 2, 3],
    questionWording: "Are you a religious person?",
    responseMapping: "1=religious 2=not religious 3=atheist; score=4-mean",
  },
  {
    metricId: "support_for_immigration",
    column: "Q130",
    mode: "inverted_mean_1_4",
    validValues: [1, 2, 3, 4],
    questionWording: "Immigration policy preference for people coming to work",
    responseMapping: "1=let anyone come to 4=prohibit; score=5-mean",
  },
  {
    metricId: "support_for_traditional_values",
    column: "Q45",
    mode: "inverted_mean_1_3",
    validValues: [1, 2, 3],
    questionWording: "Future changes: Greater respect for authority",
    responseMapping: "1=good thing to 3=bad thing; score=4-mean",
  },
];

type GroupKey = string;

type MetricBucket = {
  sum: number;
  count: number;
  yesCount: number;
  binaryTotal: number;
};

type GroupBucket = {
  countryCode: string;
  year: string;
  metrics: Map<string, MetricBucket>;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
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

function parseNumericCode(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function isValidMetricValue(spec: WvsMetricSpec, value: number): boolean {
  if (INVALID_CODES.has(value)) {
    return false;
  }
  if (spec.validValues) {
    return spec.validValues.includes(value);
  }
  return value > 0;
}

function buildRawRecordId(countryCode: string, year: string, metricId: string, value: string): string {
  return createHash("sha256")
    .update([countryCode, year, metricId, value].join(":"))
    .digest("hex")
    .slice(0, 16);
}

function formatScore(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(4);
}

function aggregateValue(spec: WvsMetricSpec, bucket: MetricBucket): number | null {
  if (spec.mode === "pct_yes") {
    if (bucket.binaryTotal === 0) {
      return null;
    }
    return (bucket.yesCount / bucket.binaryTotal) * 100;
  }

  if (bucket.count === 0) {
    return null;
  }

  const mean = bucket.sum / bucket.count;
  if (spec.mode === "inverted_mean_1_4") {
    return 5 - mean;
  }
  if (spec.mode === "inverted_mean_1_3") {
    return 4 - mean;
  }
  return mean;
}

function buildGroupKey(countryCode: string, year: string): GroupKey {
  return countryCode + ":" + year;
}

function getOrCreateGroup(
  groups: Map<GroupKey, GroupBucket>,
  countryCode: string,
  year: string,
): GroupBucket {
  const key = buildGroupKey(countryCode, year);
  const existing = groups.get(key);
  if (existing) {
    return existing;
  }

  const created: GroupBucket = {
    countryCode,
    year,
    metrics: new Map<string, MetricBucket>(),
  };
  groups.set(key, created);
  return created;
}

function getOrCreateMetricBucket(group: GroupBucket, metricId: string): MetricBucket {
  const existing = group.metrics.get(metricId);
  if (existing) {
    return existing;
  }

  const created: MetricBucket = {
    sum: 0,
    count: 0,
    yesCount: 0,
    binaryTotal: 0,
  };
  group.metrics.set(metricId, created);
  return created;
}

function bucketsToRows(groups: Map<GroupKey, GroupBucket>): WvsCanonicalRow[] {
  const rows: WvsCanonicalRow[] = [];

  for (const group of groups.values()) {
    for (const spec of WVS_METRIC_SPECS) {
      const bucket = group.metrics.get(spec.metricId);
      if (!bucket) {
        continue;
      }

      const value = aggregateValue(spec, bucket);
      if (value === null) {
        continue;
      }

      const formattedValue = formatScore(value);
      rows.push({
        country_code: group.countryCode,
        year: group.year,
        metric_id: spec.metricId,
        value: formattedValue,
        unit: WVS_UNIT,
        source_url: WVS_SOURCE_URL,
        source_name: WVS_SOURCE_NAME,
        raw_record_id: buildRawRecordId(group.countryCode, group.year, spec.metricId, formattedValue),
        calculation:
          spec.mode === "pct_yes"
            ? "country_pct_yes"
            : spec.mode === "mean"
              ? "country_mean"
              : "country_inverted_mean",
        notes: spec.column + ";wvs_wave=7",
        sample_size: String(spec.mode === "pct_yes" ? bucket.binaryTotal : bucket.count),
        question_wording: spec.questionWording,
        response_mapping: spec.responseMapping,
      });
    }
  }

  return rows.sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) {
      return country;
    }
    const year = a.year.localeCompare(b.year);
    if (year !== 0) {
      return year;
    }
    return a.metric_id.localeCompare(b.metric_id);
  });
}

async function streamAggregateWvsFile(
  filePath: string,
  groups: Map<GroupKey, GroupBucket>,
  skipReasons: TransformStats["skipReasons"],
): Promise<number> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lineReader = createInterface({ input: stream, crlfDelay: Infinity });

  let headerIndices: Record<string, number> | null = null;
  let activeMetricSpecs: WvsMetricSpec[] = [];
  let rowsRead = 0;

  for await (const rawLine of lineReader) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!line.trim()) {
      continue;
    }

    if (!headerIndices) {
      const headers = parseCsvLine(line);
      headerIndices = Object.fromEntries(headers.map((header, index) => [header, index]));
      activeMetricSpecs = WVS_METRIC_SPECS.filter((spec) => headerIndices![spec.column] !== undefined);
      for (const spec of WVS_METRIC_SPECS) {
        if (headerIndices![spec.column] === undefined) {
          incrementSkip(skipReasons, "unmapped_metric_column");
        }
      }
      continue;
    }

    rowsRead += 1;
    const cells = parseCsvLine(line);

    const countryIndex = headerIndices.B_COUNTRY_ALPHA;
    const yearIndex = headerIndices.A_YEAR;
    if (countryIndex === undefined || yearIndex === undefined) {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const countryRaw = cells[countryIndex] ?? "";
    if (!countryRaw.trim()) {
      incrementSkip(skipReasons, "missing_country");
      continue;
    }

    const countryCode = resolveMvpCountry(countryRaw);
    if (!countryCode) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }

    const yearRaw = cells[yearIndex] ?? "";
    const yearNumeric = parseNumericCode(yearRaw);
    if (yearNumeric === null || yearNumeric < 1900 || yearNumeric > 2100) {
      incrementSkip(skipReasons, "missing_date");
      continue;
    }
    const year = String(Math.trunc(yearNumeric));

    const group = getOrCreateGroup(groups, countryCode, year);

    for (const spec of activeMetricSpecs) {
      const columnIndex = headerIndices[spec.column]!;
      const numeric = parseNumericCode(cells[columnIndex] ?? "");
      if (numeric === null || !isValidMetricValue(spec, numeric)) {
        continue;
      }

      const bucket = getOrCreateMetricBucket(group, spec.metricId);
      if (spec.mode === "pct_yes") {
        bucket.binaryTotal += 1;
        if (numeric === 1) {
          bucket.yesCount += 1;
        }
      } else {
        bucket.sum += numeric;
        bucket.count += 1;
      }
    }
  }

  return rowsRead;
}

export async function transformWvsFromRawFiles(
  rawFilePaths: string[],
  outputPath: string,
): Promise<{ rows: WvsCanonicalRow[]; stats: TransformStats }> {
  const skipReasons: TransformStats["skipReasons"] = {};
  const groups = new Map<GroupKey, GroupBucket>();
  const filesRead: string[] = [];
  let rowsRead = 0;

  for (const filePath of rawFilePaths) {
    const relativePath = path.relative(repoPath(), filePath).replace(/\\/g, "/");
    const fileRows = await streamAggregateWvsFile(filePath, groups, skipReasons);
    if (fileRows > 0) {
      filesRead.push(relativePath);
      rowsRead += fileRows;
    }
  }

  const rows = bucketsToRows(groups);
  const rowsSkipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows,
    stats: {
      sourceId: "world_values_survey",
      rawFilesRead: filesRead,
      rowsRead,
      rowsWritten: rows.length,
      rowsSkipped,
      skipReasons,
      outputPath,
      implemented: true,
    },
  };
}
