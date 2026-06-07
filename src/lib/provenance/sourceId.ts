export function normalizeSourceId(sourceId: string): string {
  return sourceId.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export function buildDerivedSourceId(sourceId: string): string {
  return `derived_from_${normalizeSourceId(sourceId)}`;
}
