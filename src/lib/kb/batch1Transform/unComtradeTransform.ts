import { createHash } from "node:crypto";
import type { ManualRecord } from "@/lib/sources/tabularParser";
import { buildRelationshipId } from "@/lib/globe/countryIdMap";
import { getField } from "./rawFiles";
import { incrementSkip, resolveMvpCountry } from "./mvpFilter";
import type { CanonicalMetricRow, TransformStats } from "./types";

const COMTRADE_SOURCE_URL = "https://comtradeplus.un.org/TradeFlow";
const COMTRADE_SOURCE_NAME = "UN Comtrade";
const COMTRADE_UNIT = "current_usd";

function resolveTradeMetricId(flowRaw: string): string | null {
  const normalized = flowRaw.trim().toUpperCase();
  if (normalized === "M" || normalized === "IMPORT" || normalized === "IMPORTS") {
    return "imports_total_usd";
  }
  if (normalized === "X" || normalized === "EXPORT" || normalized === "EXPORTS") {
    return "exports_total_usd";
  }
  return null;
}

function isWorldPartner(partnerCode: string, partnerIso: string, partnerDesc: string): boolean {
  const code = partnerCode.trim();
  const iso = partnerIso.trim().toUpperCase();
  const desc = partnerDesc.trim().toUpperCase();
  return code === "0" || iso === "W00" || desc === "WORLD";
}

function resolvePartnerCode(partnerCode: string, partnerIso: string, partnerDesc: string): string | null {
  if (isWorldPartner(partnerCode, partnerIso, partnerDesc)) {
    return "WLD";
  }
  return resolveMvpCountry(partnerIso || partnerDesc);
}

function buildPartnerNotes(partnerCode: string, partnerIso: string, partnerDesc: string, partnerIso3: string): string {
  const parts = [`partner=${partnerIso3}`];
  if (partnerDesc) {
    parts.push(`partner_name=${partnerDesc}`);
  }
  if (partnerIso) {
    parts.push(`partner_iso=${partnerIso}`);
  }
  if (partnerCode) {
    parts.push(`partner_code=${partnerCode}`);
  }
  return parts.join("; ");
}

function buildRawRecordId(parts: string[]): string {
  const joined = parts.map((part) => part.trim()).filter(Boolean).join(":");
  return createHash("sha256").update(joined).digest("hex").slice(0, 16);
}

function partnerGroupKey(partnerIso3: string): string {
  return partnerIso3;
}

function sortMetricRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  return [...rows].sort((a, b) => {
    const country = a.country_code.localeCompare(b.country_code);
    if (country !== 0) return country;
    const year = a.year.localeCompare(b.year);
    if (year !== 0) return year;
    const notes = a.notes.localeCompare(b.notes);
    if (notes !== 0) return notes;
    return a.metric_id.localeCompare(b.metric_id);
  });
}

function deriveTradeBalanceRows(rows: CanonicalMetricRow[]): CanonicalMetricRow[] {
  const grouped = new Map<string, CanonicalMetricRow[]>();

  for (const row of rows) {
    const partnerMatch = row.notes.match(/partner=([A-Z]{3})/);
    const partnerIso3 = partnerMatch?.[1] ?? "unknown";
    const key = `${row.country_code}:${row.year}:${partnerGroupKey(partnerIso3)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const derived: CanonicalMetricRow[] = [];

  for (const groupRows of grouped.values()) {
    const exportsRow = groupRows.find((row) => row.metric_id === "exports_total_usd");
    const importsRow = groupRows.find((row) => row.metric_id === "imports_total_usd");
    if (!exportsRow || !importsRow) {
      continue;
    }

    const exportValue = Number(exportsRow.value);
    const importValue = Number(importsRow.value);
    if (!Number.isFinite(exportValue) || !Number.isFinite(importValue)) {
      continue;
    }

    derived.push({
      country_code: exportsRow.country_code,
      year: exportsRow.year,
      metric_id: "trade_balance_usd",
      value: String(exportValue - importValue),
      unit: COMTRADE_UNIT,
      source_url: COMTRADE_SOURCE_URL,
      source_name: COMTRADE_SOURCE_NAME,
      raw_record_id: buildRawRecordId([
        "trade_balance_usd",
        exportsRow.raw_record_id,
        importsRow.raw_record_id,
      ]),
      calculation: "exports_total_usd - imports_total_usd",
      notes: exportsRow.notes + "; derived=trade_balance_usd",
    });
  }

  return derived;
}

export function transformUnComtrade(
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { rows: CanonicalMetricRow[]; stats: TransformStats } {
  const skipReasons: TransformStats["skipReasons"] = {};
  const rows: CanonicalMetricRow[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const commodityCode = getField(record, ["cmdcode", "commodity_code", "cmd_code"]).toUpperCase();
    if (commodityCode !== "TOTAL") {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const reporterRaw = getField(record, ["reporteriso", "reporter_iso", "reporterdesc", "reporter_desc", "reporter"]);
    const reporterCode = resolveMvpCountry(reporterRaw);
    if (!reporterRaw) {
      incrementSkip(skipReasons, "missing_country");
      continue;
    }
    if (!reporterCode) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }

    const partnerCode = getField(record, ["partnercode", "partner_code"]);
    const partnerIso = getField(record, ["partneriso", "partner_iso"]);
    const partnerDesc = getField(record, ["partnerdesc", "partner_desc", "partner"]);
    const partnerIso3 = resolvePartnerCode(partnerCode, partnerIso, partnerDesc);
    if (!partnerIso3) {
      incrementSkip(skipReasons, "non_mvp_country");
      continue;
    }

    const year = getField(record, ["period", "refyear", "ref_year", "year"]);
    if (!year) {
      incrementSkip(skipReasons, "missing_required_field");
      continue;
    }

    const flowRaw = getField(record, ["flowcode", "flow_code", "flowdesc", "flow_desc", "trade_flow"]);
    const metricId = resolveTradeMetricId(flowRaw);
    if (!metricId) {
      incrementSkip(skipReasons, "unmapped_metric_column");
      continue;
    }

    const value = getField(record, [
      "primaryvalue",
      "primary_value",
      "trade_value_(us$)",
      "trade_value_us$",
      "trade_value",
      "cifvalue",
      "fobvalue",
    ]);
    if (!value) {
      incrementSkip(skipReasons, "empty_value");
      continue;
    }

    const reporterCodeRaw = getField(record, ["reportercode", "reporter_code"]);
    const dedupeKey = [year, reporterCode, partnerIso3, metricId, commodityCode].join(":");
    if (seen.has(dedupeKey)) {
      incrementSkip(skipReasons, "duplicate_row");
      continue;
    }
    seen.add(dedupeKey);

    const notesParts = [buildPartnerNotes(partnerCode, partnerIso, partnerDesc, partnerIso3)];
    if (partnerIso3 !== "WLD" && reporterCode !== partnerIso3) {
      notesParts.push(`relationship_id=${buildRelationshipId(reporterCode, partnerIso3)}`);
    }
    if (partnerIso3 === "WLD") {
      notesParts.push("trade_scope=country_total");
    } else {
      notesParts.push("trade_scope=bilateral");
    }

    rows.push({
      country_code: reporterCode,
      year,
      metric_id: metricId,
      value,
      unit: COMTRADE_UNIT,
      source_url: COMTRADE_SOURCE_URL,
      source_name: COMTRADE_SOURCE_NAME,
      raw_record_id: buildRawRecordId([
        year,
        reporterCodeRaw || reporterRaw,
        partnerCode || partnerIso || partnerDesc,
        flowRaw,
        commodityCode,
      ]),
      calculation: "",
      notes: notesParts.filter(Boolean).join("; "),
    });
  }

  const withBalances = [...rows, ...deriveTradeBalanceRows(rows)];
  const deduped = sortMetricRows(withBalances);
  const skipped = Object.values(skipReasons).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    rows: deduped,
    stats: {
      sourceId: "un_comtrade",
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
