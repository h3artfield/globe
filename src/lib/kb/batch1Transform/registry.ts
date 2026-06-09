import type { ManualRecord } from "@/lib/sources/tabularParser";
import { transformAcled } from "./acledTransform";
import { transformCorrelatesOfWar } from "./cowTransform";
import { transformUcdp } from "./ucdpTransform";
import { createStubTransformStats, STUB_TRANSFORM_MESSAGE } from "./stubTransform";
import type { CanonicalEventRow, CanonicalMetricRow, TransformStats } from "./types";
import { EVENT_CANONICAL_HEADERS, METRIC_CANONICAL_HEADERS } from "./types";
import { transformUnComtrade } from "./unComtradeTransform";
import { transformUnescoUis } from "./unescoUisTransform";
import { transformUnctad } from "./unctadTransform";
import { transformUnodc } from "./unodcTransform";
import { transformVdem } from "./vdemTransform";
import { transformWipo } from "./wipoTransform";

export type Batch1SourceKind = "metric" | "event";

export type Batch1SourceConfig = {
  sourceId: string;
  rawFolder: string;
  canonicalFolder: string;
  canonicalFilename: string;
  kind: Batch1SourceKind;
  implemented: boolean;
  rawObservationFiles?: string[];
};

export const BATCH1_TRANSFORM_SOURCES: Batch1SourceConfig[] = [
  {
    sourceId: "vdem",
    rawFolder: "vdem",
    canonicalFolder: "vdem",
    canonicalFilename: "vdem_country_year.csv",
    kind: "metric",
    implemented: true,
  },
  {
    sourceId: "un_comtrade",
    rawFolder: "un_comtrade",
    canonicalFolder: "un_comtrade",
    canonicalFilename: "un_comtrade_bilateral.csv",
    kind: "metric",
    implemented: true,
  },
  {
    sourceId: "unodc",
    rawFolder: "unodc",
    canonicalFolder: "unodc",
    canonicalFilename: "unodc_crime.csv",
    kind: "metric",
    implemented: true,
  },
  {
    sourceId: "unesco_uis",
    rawFolder: "unesco_uis",
    canonicalFolder: "unesco_uis",
    canonicalFilename: "unesco_uis_education.csv",
    kind: "metric",
    implemented: true,
    rawObservationFiles: ["data.csv"],
  },
  {
    sourceId: "wipo",
    rawFolder: "wipo",
    canonicalFolder: "wipo",
    canonicalFilename: "wipo_patents.csv",
    kind: "metric",
    implemented: true,
    rawObservationFiles: ["wipo_patent_family_by_origin.csv"],
  },
  {
    sourceId: "world_values_survey",
    rawFolder: "world_values_survey",
    canonicalFolder: "world_values_survey",
    canonicalFilename: "wvs_country_crosstabs.csv",
    kind: "metric",
    implemented: true,
    rawObservationFiles: ["wvs_wave7_crossnational.csv"],
  },
  {
    sourceId: "oecd_pisa",
    rawFolder: "oecd_pisa",
    canonicalFolder: "oecd_pisa",
    canonicalFilename: "oecd_pisa_scores.csv",
    kind: "metric",
    implemented: true,
    rawObservationFiles: ["pisa_math.xlsx", "pisa_reading.xlsx", "pisa_science.xlsx"],
  },
  {
    sourceId: "unctad",
    rawFolder: "unctad",
    canonicalFolder: "unctad",
    canonicalFilename: "unctad_trade_maritime.csv",
    kind: "metric",
    implemented: true,
    rawObservationFiles: ["unctad_lsci.csv", "unctad_trade_openness.csv"],
  },
  {
    sourceId: "acled",
    rawFolder: "acled",
    canonicalFolder: "acled",
    canonicalFilename: "acled_events.csv",
    kind: "event",
    implemented: true,
  },
  {
    sourceId: "ucdp",
    rawFolder: "ucdp",
    canonicalFolder: "ucdp",
    canonicalFilename: "ucdp_conflict.csv",
    kind: "event",
    implemented: true,
  },
  {
    sourceId: "correlates_of_war",
    rawFolder: "correlates_of_war",
    canonicalFolder: "correlates_of_war",
    canonicalFilename: "cow_alliances_wars.csv",
    kind: "event",
    implemented: true,
  },
];

export type TransformOutput =
  | { kind: "metric"; rows: CanonicalMetricRow[]; headers: readonly string[] }
  | { kind: "event"; rows: CanonicalEventRow[]; headers: readonly string[] };

export function runSourceTransform(
  config: Batch1SourceConfig,
  records: ManualRecord[],
  rawFilesRead: string[],
  outputPath: string,
): { output: TransformOutput | null; stats: TransformStats } {
  if (!config.implemented) {
    return {
      output: null,
      stats: createStubTransformStats(config.sourceId, outputPath, rawFilesRead, records.length),
    };
  }

  if (config.sourceId === "un_comtrade") {
    const result = transformUnComtrade(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "unodc") {
    const result = transformUnodc(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "unesco_uis") {
    const result = transformUnescoUis(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "wipo") {
    const result = transformWipo(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "unctad") {
    const result = transformUnctad(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "vdem") {
    const result = transformVdem(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "metric",
        rows: result.rows,
        headers: METRIC_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "acled") {
    const result = transformAcled(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "event",
        rows: result.rows,
        headers: EVENT_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "ucdp") {
    const result = transformUcdp(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "event",
        rows: result.rows,
        headers: EVENT_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  if (config.sourceId === "correlates_of_war") {
    const result = transformCorrelatesOfWar(records, rawFilesRead, outputPath);
    return {
      output: {
        kind: "event",
        rows: result.rows,
        headers: EVENT_CANONICAL_HEADERS,
      },
      stats: result.stats,
    };
  }

  return {
    output: null,
    stats: createStubTransformStats(config.sourceId, outputPath, rawFilesRead, records.length),
  };
}

export { STUB_TRANSFORM_MESSAGE };
