import type { TransformStats } from "./types";

export const STUB_TRANSFORM_MESSAGE =
  "Transformer not implemented yet; use template format or implement mapping.";

export function createStubTransformStats(
  sourceId: string,
  outputPath: string,
  rawFilesRead: string[],
  rowsRead: number,
): TransformStats {
  return {
    sourceId,
    rawFilesRead,
    rowsRead,
    rowsWritten: 0,
    rowsSkipped: rowsRead,
    skipReasons: {},
    outputPath,
    implemented: false,
    error: STUB_TRANSFORM_MESSAGE,
  };
}
