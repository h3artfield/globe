import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ForecastSourceRequest,
  ForecastSourceRequestType,
  ReplayForecastConfidence,
  SourceFulfillmentRecord,
} from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath } from "@/lib/pipeline/io";
import { loadCountryMetrics } from "@/lib/forecasting/replay/loadCountryMetrics";
import { writeFulfillmentArtifact } from "@/lib/forecasting/sourceFulfillmentStore";
import {
  assertSafeLocalPath,
  assertSupportedExtension,
  resolveSafeLocalPath,
} from "@/lib/forecasting/sourceFulfillment/localPathSafety";
import type { SourceFulfillmentArtifact } from "@/types/forecasting";

export type SourceFulfillmentInput = {
  local_paths?: string[];
  note_text?: string;
  safe_for_evidence_snapshot?: boolean;
  summary?: string;
  limitations?: string;
  confidence?: ReplayForecastConfidence;
  fulfilled_by?: string;
};

export type SourceFulfillmentAdapterResult = {
  records_found: number;
  records_usable: SourceFulfillmentRecord[];
  records_rejected: number;
  rejected_future_records_count: number;
  local_paths: string[];
  summary: string;
  limitations: string;
  confidence: ReplayForecastConfidence;
  safe_for_evidence_snapshot: boolean;
};

export type SourceFulfillmentAdapter = {
  adapter_id: string;
  source_id: string;
  request_types: ForecastSourceRequestType[];
  canFulfill(request: ForecastSourceRequest, input: SourceFulfillmentInput): boolean;
  fulfill(
    request: ForecastSourceRequest,
    input: SourceFulfillmentInput,
  ): Promise<SourceFulfillmentAdapterResult>;
  validateCutoff(
    request: ForecastSourceRequest,
    result: SourceFulfillmentAdapterResult,
  ): SourceFulfillmentAdapterResult;
  writeFulfillmentArtifact(
    request: ForecastSourceRequest,
    result: SourceFulfillmentAdapterResult,
    meta: {
      fulfilled_by: string;
      fulfillment_type: SourceFulfillmentArtifact["fulfillment_type"];
    },
  ): SourceFulfillmentArtifact;
};

function resolveLocalPath(localPath: string): string {
  assertSafeLocalPath(localPath);
  return resolveSafeLocalPath(localPath);
}

function yearFromRecord(record: Partial<SourceFulfillmentRecord>): number | null {
  if (typeof record.year === "number" && Number.isFinite(record.year)) {
    return record.year;
  }
  if (record.date) {
    const match = /^(\d{4})/.exec(record.date);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function applyCutoffValidation(
  request: ForecastSourceRequest,
  result: SourceFulfillmentAdapterResult,
): SourceFulfillmentAdapterResult {
  const cutoff = request.cutoff_year;
  const usable: SourceFulfillmentRecord[] = [];
  let rejectedFuture = 0;
  let rejectedOther = 0;

  for (const record of result.records_usable) {
    const year = yearFromRecord(record);
    if (year !== null && year > cutoff) {
      rejectedFuture += 1;
      continue;
    }
    usable.push(record);
  }

  rejectedOther = result.records_rejected;

  return {
    ...result,
    records_usable: usable,
    records_rejected: rejectedOther + rejectedFuture,
    rejected_future_records_count: rejectedFuture,
    summary:
      rejectedFuture > 0
        ? `${result.summary} Excluded ${rejectedFuture} record(s) after cutoff ${cutoff}.`
        : result.summary,
  };
}

async function parseJsonRecords(
  filePath: string,
  sourceId: string,
): Promise<SourceFulfillmentRecord[]> {
  const payload = await readJsonFile<unknown>(filePath);
  if (Array.isArray(payload)) {
    return payload.map((item, index) => normalizeJsonRecord(item, sourceId, index, filePath));
  }
  if (payload && typeof payload === "object") {
    const obj = payload as { metrics?: unknown[]; records?: unknown[] };
    const rows = obj.metrics ?? obj.records;
    if (Array.isArray(rows)) {
      return rows.map((item, index) => normalizeJsonRecord(item, sourceId, index, filePath));
    }
  }
  return [
    {
      record_id: `${sourceId}:${path.basename(filePath)}:0`,
      source_id: sourceId,
      label: path.basename(filePath),
      year: null,
      date: null,
      value_summary: "JSON object loaded (no array records)",
    },
  ];
}

function normalizeJsonRecord(
  item: unknown,
  sourceId: string,
  index: number,
  filePath: string,
): SourceFulfillmentRecord {
  if (!item || typeof item !== "object") {
    return {
      record_id: `${sourceId}:${path.basename(filePath)}:${index}`,
      source_id: sourceId,
      label: `record ${index}`,
      year: null,
      date: null,
      value_summary: String(item),
    };
  }
  const row = item as Record<string, unknown>;
  const year =
    typeof row.year === "number"
      ? row.year
      : typeof row.observation_year === "number"
        ? row.observation_year
        : null;
  const value =
    row.value_summary ??
    row.value ??
    row.text ??
    JSON.stringify(row).slice(0, 120);
  return {
    record_id:
      (typeof row.raw_record_id === "string" && row.raw_record_id) ||
      (typeof row.record_id === "string" && row.record_id) ||
      `${sourceId}:${path.basename(filePath)}:${index}`,
    source_id: (typeof row.source_id === "string" && row.source_id) || sourceId,
    label:
      (typeof row.label === "string" && row.label) ||
      (typeof row.metric_id === "string" && row.metric_id) ||
      `record ${index}`,
    year,
    date: typeof row.date === "string" ? row.date : null,
    value_summary: String(value),
  };
}

async function parseJsonlRecords(
  filePath: string,
  sourceId: string,
): Promise<SourceFulfillmentRecord[]> {
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const records: SourceFulfillmentRecord[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      records.push(normalizeJsonRecord(JSON.parse(lines[index]!), sourceId, index, filePath));
    } catch {
      records.push({
        record_id: `${sourceId}:${path.basename(filePath)}:${index}`,
        source_id: sourceId,
        label: `line ${index + 1}`,
        year: null,
        date: null,
        value_summary: lines[index]!.slice(0, 200),
      });
    }
  }
  return records;
}

async function parseCsvRecords(
  filePath: string,
  sourceId: string,
): Promise<SourceFulfillmentRecord[]> {
  const text = await readFile(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0]!.split(",").map((cell) => cell.trim().toLowerCase());
  const yearIndex = headers.findIndex((header) =>
    ["year", "observation_year", "event_year"].includes(header),
  );
  const records: SourceFulfillmentRecord[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const cells = lines[rowIndex]!.split(",").map((cell) => cell.trim());
    const year =
      yearIndex >= 0 && cells[yearIndex] ? Number(cells[yearIndex]) : null;
    records.push({
      record_id: `${sourceId}:${path.basename(filePath)}:${rowIndex}`,
      source_id: sourceId,
      label: `row ${rowIndex}`,
      year: Number.isFinite(year) ? year : null,
      date: null,
      value_summary: cells.join(" | ").slice(0, 200),
    });
  }
  return records;
}

async function parseTextNote(
  filePath: string,
  sourceId: string,
  noteText?: string,
): Promise<SourceFulfillmentRecord[]> {
  const text =
    noteText ??
    (filePath && (await pathExists(filePath)) ? await readFile(filePath, "utf8") : "");
  if (!text.trim()) {
    return [];
  }
  return [
    {
      record_id: `${sourceId}:note:${Date.now()}`,
      source_id: sourceId,
      label: filePath ? path.basename(filePath) : "operator note",
      year: null,
      date: null,
      value_summary: text.trim().slice(0, 500),
    },
  ];
}

export async function loadRecordsFromLocalPath(
  localPath: string,
  sourceId: string,
): Promise<{ records: SourceFulfillmentRecord[]; resolvedPath: string }> {
  const resolvedPath = resolveLocalPath(localPath);
  if (!(await pathExists(resolvedPath))) {
    throw new Error(`Local path not found: ${localPath}`);
  }
  assertSupportedExtension(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  let records: SourceFulfillmentRecord[];
  if (ext === ".json") {
    records = await parseJsonRecords(resolvedPath, sourceId);
  } else if (ext === ".jsonl") {
    records = await parseJsonlRecords(resolvedPath, sourceId);
  } else if (ext === ".csv") {
    records = await parseCsvRecords(resolvedPath, sourceId);
  } else {
    records = await parseTextNote(resolvedPath, sourceId);
  }
  const relative = path.relative(process.cwd(), resolvedPath).replaceAll("\\", "/");
  return { records, resolvedPath: relative };
}

function baseAdapter(
  adapterId: string,
  sourceId: string,
  requestTypes: ForecastSourceRequestType[],
  fulfillFn: (
    request: ForecastSourceRequest,
    input: SourceFulfillmentInput,
  ) => Promise<SourceFulfillmentAdapterResult>,
): SourceFulfillmentAdapter {
  return {
    adapter_id: adapterId,
    source_id: sourceId,
    request_types: requestTypes,
    canFulfill(request, input) {
      if (adapterId !== "manual_file") {
        if (
          request.requested_source_id !== sourceId &&
          request.suggested_api_adapter !== adapterId
        ) {
          return false;
        }
      }
      if (!requestTypes.includes(request.request_type)) {
        return false;
      }
      if (adapterId === "manual_file") {
        return Boolean(input.local_paths?.length || input.note_text?.trim());
      }
      return true;
    },
    fulfill: fulfillFn,
    validateCutoff(request, result) {
      return applyCutoffValidation(request, result);
    },
    writeFulfillmentArtifact(request, result, meta) {
      return writeFulfillmentArtifact(request, {
        ...result,
        fulfilled_by: meta.fulfilled_by,
        fulfillment_type: meta.fulfillment_type,
      });
    },
  };
}

async function fulfillFromCountryMetrics(
  request: ForecastSourceRequest,
  sourceId: string,
  input: SourceFulfillmentInput,
): Promise<SourceFulfillmentAdapterResult> {
  const country = request.target_country_iso3;
  if (!country) {
    return emptyResult(sourceId, "No target country on request.");
  }
  const loaded = await loadCountryMetrics(country);
  if (!loaded) {
    return emptyResult(sourceId, `No processed metrics for ${country}.`);
  }
  const rows = loaded.metrics.filter((row) => row.source_id === sourceId);
  const records: SourceFulfillmentRecord[] = rows.map((row) => ({
    record_id: row.raw_record_id,
    source_id: row.source_id,
    label: `${row.metric_id} (${row.country_code}, ${row.year})`,
    year: row.year,
    date: null,
    value_summary: `${row.value} ${row.unit}`,
  }));
  return {
    records_found: records.length,
    records_usable: records,
    records_rejected: 0,
    rejected_future_records_count: 0,
    local_paths: input.local_paths?.length ? input.local_paths : [loaded.filePath],
    summary: `${records.length} ${sourceId} metric row(s) from local processed file.`,
    limitations: "Local adapter reads processed country metrics only.",
    confidence: records.length > 0 ? "medium" : "low",
    safe_for_evidence_snapshot: input.safe_for_evidence_snapshot ?? true,
  };
}

async function fulfillManualFile(
  request: ForecastSourceRequest,
  input: SourceFulfillmentInput,
): Promise<SourceFulfillmentAdapterResult> {
  const sourceId = request.requested_source_id;
  const paths = input.local_paths ?? [];
  const allRecords: SourceFulfillmentRecord[] = [];
  const resolvedPaths: string[] = [];

  for (const localPath of paths) {
    const loaded = await loadRecordsFromLocalPath(localPath, sourceId);
    allRecords.push(...loaded.records);
    resolvedPaths.push(loaded.resolvedPath);
  }

  if (input.note_text?.trim()) {
    allRecords.push(...(await parseTextNote("", sourceId, input.note_text)));
  }

  return {
    records_found: allRecords.length,
    records_usable: allRecords,
    records_rejected: 0,
    rejected_future_records_count: 0,
    local_paths: resolvedPaths,
    summary:
      input.summary?.trim() ||
      `Loaded ${allRecords.length} record(s) from ${resolvedPaths.length} local path(s) or note.`,
    limitations: input.limitations?.trim() || "Human-provided local file or note.",
    confidence: input.confidence ?? (allRecords.length > 0 ? "medium" : "low"),
    safe_for_evidence_snapshot: input.safe_for_evidence_snapshot ?? true,
  };
}

function emptyResult(sourceId: string, summary: string): SourceFulfillmentAdapterResult {
  return {
    records_found: 0,
    records_usable: [],
    records_rejected: 0,
    rejected_future_records_count: 0,
    local_paths: [],
    summary,
    limitations: "No local records found.",
    confidence: "low",
    safe_for_evidence_snapshot: false,
  };
}

function scaffoldAdapter(
  adapterId: string,
  sourceId: string,
): SourceFulfillmentAdapter {
  return baseAdapter(adapterId, sourceId, ["api_fetch", "dataset_refresh"], async () =>
    emptyResult(
      sourceId,
      `${adapterId} adapter is scaffolded for local/mock use only; configure local paths or use manual_file.`,
    ),
  );
}

export const manualFileAdapter = baseAdapter(
  "manual_file",
  "*",
  ["human_upload", "dataset_refresh", "clarification", "api_fetch"],
  fulfillManualFile,
);

export const gdeltNewsEventsAdapter = scaffoldAdapter("gdelt_news_events", "gdelt");
export const unComtradeFulfillmentAdapter = baseAdapter(
  "un_comtrade_bilateral",
  "un_comtrade",
  ["dataset_refresh", "api_fetch"],
  (request, input) => fulfillFromCountryMetrics(request, "un_comtrade", input),
);
export const vdemFulfillmentAdapter = baseAdapter(
  "vdem",
  "vdem",
  ["dataset_refresh", "api_fetch"],
  (request, input) => fulfillFromCountryMetrics(request, "vdem", input),
);
export const ucdpFulfillmentAdapter = baseAdapter(
  "ucdp",
  "ucdp",
  ["dataset_refresh", "api_fetch"],
  (request, input) => fulfillFromCountryMetrics(request, "ucdp", input),
);
export const unodcFulfillmentAdapter = baseAdapter(
  "unodc",
  "unodc",
  ["human_upload", "dataset_refresh", "api_fetch"],
  (request, input) => fulfillFromCountryMetrics(request, "unodc", input),
);
export const wvsFulfillmentAdapter = baseAdapter(
  "wvs",
  "world_values_survey",
  ["dataset_refresh", "api_fetch"],
  (request, input) => fulfillFromCountryMetrics(request, "world_values_survey", input),
);
