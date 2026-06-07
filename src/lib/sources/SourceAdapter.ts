export type SourceAdapter = {
  sourceId: string;
  fetchRaw: () => Promise<void>;
  normalize: () => Promise<void>;
  validate: () => Promise<void>;
};
