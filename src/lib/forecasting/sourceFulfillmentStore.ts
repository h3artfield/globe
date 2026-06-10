import path from "node:path";
import { randomBytes } from "node:crypto";
import type { SourceFulfillmentArtifact } from "@/types/forecasting";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";

const FULFILLMENTS_DIR = repoPath("data", "forecasting", "source_fulfillments");

function fulfillmentFilePath(sourceRequestId: string): string {
  return path.join(FULFILLMENTS_DIR, sourceRequestId, "fulfillment.v1.json");
}

export function createFulfillmentId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = randomBytes(3).toString("hex");
  return `fulfillment_${stamp}_${suffix}`;
}

export async function saveSourceFulfillment(
  artifact: SourceFulfillmentArtifact,
): Promise<void> {
  await writeJsonFile(fulfillmentFilePath(artifact.source_request_id), artifact);
}

export async function loadSourceFulfillment(
  sourceRequestId: string,
): Promise<SourceFulfillmentArtifact | null> {
  const filePath = fulfillmentFilePath(sourceRequestId);
  if (!(await pathExists(filePath))) {
    return null;
  }
  return readJsonFile<SourceFulfillmentArtifact>(filePath);
}

export async function loadSourceFulfillmentsForSession(
  sessionId: string,
): Promise<SourceFulfillmentArtifact[]> {
  const { readdir } = await import("node:fs/promises");
  let entries: string[] = [];
  try {
    entries = await readdir(FULFILLMENTS_DIR, { withFileTypes: true }).then((items) =>
      items.filter((item) => item.isDirectory()).map((item) => item.name),
    );
  } catch {
    return [];
  }

  const artifacts: SourceFulfillmentArtifact[] = [];
  for (const id of entries) {
    const artifact = await loadSourceFulfillment(id);
    if (artifact && artifact.session_id === sessionId) {
      artifacts.push(artifact);
    }
  }
  return artifacts.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function writeFulfillmentArtifact(
  request: {
    source_request_id: string;
    session_id: string;
    agent_id: string | null;
    requested_source_id: string;
    cutoff_year: number;
    too_late_for_forecast: boolean;
  },
  result: {
    fulfilled_by: string;
    fulfillment_type: SourceFulfillmentArtifact["fulfillment_type"];
    local_paths: string[];
    records_found: number;
    records_usable: SourceFulfillmentArtifact["records_usable"];
    records_rejected: number;
    rejected_future_records_count: number;
    summary: string;
    limitations: string;
    confidence: SourceFulfillmentArtifact["confidence"];
    safe_for_evidence_snapshot: boolean;
  },
): SourceFulfillmentArtifact {
  const usableForOriginal = !request.too_late_for_forecast;
  return {
    fulfillment_id: createFulfillmentId(),
    source_request_id: request.source_request_id,
    session_id: request.session_id,
    agent_id: request.agent_id,
    created_at: new Date().toISOString(),
    fulfilled_by: result.fulfilled_by,
    fulfillment_type: result.fulfillment_type,
    source_id: request.requested_source_id,
    local_paths: result.local_paths,
    records_found: result.records_found,
    records_usable: result.records_usable,
    records_rejected: result.records_rejected,
    rejected_future_records_count: result.rejected_future_records_count,
    cutoff_year: request.cutoff_year,
    summary: result.summary,
    limitations: result.limitations,
    confidence: result.confidence,
    safe_for_evidence_snapshot: result.safe_for_evidence_snapshot,
    usable_for_original_forecast: usableForOriginal,
  };
}
