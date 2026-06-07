import type { SourceAdapter } from "../SourceAdapter";
import { ManualFileAdapter } from "./manualFileAdapter";
import { StubSourceAdapter } from "./stubAdapter";
import { WorldBankAdapter } from "./worldBankAdapter";

export function getSourceAdapters(): SourceAdapter[] {
  return [
    new WorldBankAdapter(),
    new ManualFileAdapter("un_comtrade"),
    new ManualFileAdapter("unodc"),
    new ManualFileAdapter("vdem"),
    new ManualFileAdapter("un_desa_migrant_stock"),
    new ManualFileAdapter("wipo"),
    new ManualFileAdapter("world_values_survey"),
    new ManualFileAdapter("oecd_pisa"),
    new ManualFileAdapter("unesco_uis"),
    new ManualFileAdapter("unctad"),
    new StubSourceAdapter("future_source_stub", "Reserved placeholder for future source adapters."),
  ];
}

export function getSourceAdapter(sourceId: string): SourceAdapter | null {
  return getSourceAdapters().find((adapter) => adapter.sourceId === sourceId) ?? null;
}
