import path from "node:path";
import type { SourceConfig } from "@/types/pipeline";
import type { WorldEvent } from "@/types/worldModel";
import { archiveManualImportFiles, findManualImportFiles } from "@/lib/sources/manualImport";
import { isExampleEventRow, recordToWorldEvent } from "@/lib/sources/eventRecordParser";
import { loadSourceConfig } from "@/lib/sources/sourceConfigLoader";
import { parseManualFile } from "@/lib/sources/tabularParser";
import { pathExists, readJsonFile, repoPath, writeJsonFile } from "@/lib/pipeline/io";
import type { SourceAdapter } from "../SourceAdapter";

export type ProcessedEventsFile = {
  source_id: string;
  version: "1.0";
  generated_at: string;
  events: WorldEvent[];
};

function processedEventsPath(sourceId: string): string {
  return repoPath("data", "processed", "events", sourceId, "events.v1.json");
}

function dedupeEvents(events: WorldEvent[]): WorldEvent[] {
  const byId = new Map<string, WorldEvent>();
  for (const event of events) {
    byId.set(event.event_id, event);
  }
  return [...byId.values()].sort((a, b) => a.event_date.localeCompare(b.event_date));
}

export class EventManualFileAdapter implements SourceAdapter {
  private config: SourceConfig | null = null;
  private rawFiles: string[] = [];
  private retrievedAt = new Date().toISOString();
  private normalizedEvents: WorldEvent[] = [];

  constructor(public sourceId: string) {}

  async fetchRaw(): Promise<void> {
    this.config = await loadSourceConfig(this.sourceId);
    const manualFiles = await findManualImportFiles(this.config);
    const archived = await archiveManualImportFiles(this.config, manualFiles);
    this.rawFiles = archived.archivedFiles;
  }

  async normalize(): Promise<void> {
    if (!this.config) {
      this.config = await loadSourceConfig(this.sourceId);
    }

    const events: WorldEvent[] = [];
    for (const rawFile of this.rawFiles) {
      const records = await parseManualFile(rawFile);
      for (const record of records) {
        if (isExampleEventRow(record)) continue;
        const event = recordToWorldEvent(this.sourceId, record);
        if (event) {
          events.push(event);
        }
      }
    }

    const existing = (await pathExists(processedEventsPath(this.sourceId)))
      ? (await readJsonFile<ProcessedEventsFile>(processedEventsPath(this.sourceId))).events
      : [];

    this.normalizedEvents = dedupeEvents([...existing, ...events]);
    await writeJsonFile(processedEventsPath(this.sourceId), {
      source_id: this.sourceId,
      version: "1.0",
      generated_at: this.retrievedAt,
      events: this.normalizedEvents,
    } satisfies ProcessedEventsFile);

    if (this.normalizedEvents.length > 0) {
      console.log(
        this.sourceId +
          ": wrote " +
          this.normalizedEvents.length +
          " event(s) to data/processed/events/" +
          this.sourceId +
          "/events.v1.json",
      );
    }
  }

  async validate(): Promise<void> {
    if (this.rawFiles.length === 0) {
      return;
    }

    const warnings: string[] = [];
    for (const rawFile of this.rawFiles) {
      const records = await parseManualFile(rawFile);
      for (const [index, record] of records.entries()) {
        const event = recordToWorldEvent(this.sourceId, record);
        if (!event) {
          warnings.push(path.basename(rawFile) + ":" + (index + 2) + ": skipped invalid event row");
        }
      }
    }

    for (const warning of warnings) {
      console.warn("Warning: " + warning);
    }
  }
}
