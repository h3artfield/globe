import type { SourceAdapter } from "./SourceAdapter";

export async function runSourceAdapter(adapter: SourceAdapter): Promise<void> {
  await adapter.fetchRaw();
  await adapter.normalize();
  await adapter.validate();
}

export async function runSourceAdapters(adapters: SourceAdapter[]): Promise<void> {
  for (const adapter of adapters) {
    await runSourceAdapter(adapter);
  }
}
