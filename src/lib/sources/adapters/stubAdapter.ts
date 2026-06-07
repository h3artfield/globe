import { writeJsonFile, repoPath } from "@/lib/pipeline/io";
import type { SourceAdapter } from "../SourceAdapter";

export class StubSourceAdapter implements SourceAdapter {
  constructor(
    public sourceId: string,
    private message: string,
  ) {}

  async fetchRaw(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await writeJsonFile(repoPath("data", "raw", this.sourceId, today, "README.json"), {
      source_id: this.sourceId,
      fetched_at: new Date().toISOString(),
      status: "stub",
      message: this.message,
    });
  }

  async normalize(): Promise<void> {
    return Promise.resolve();
  }

  async validate(): Promise<void> {
    return Promise.resolve();
  }
}
