import type { SourceAdapter } from "../SourceAdapter";
import { StubSourceAdapter } from "./stubAdapter";
import { WorldBankAdapter } from "./worldBankAdapter";

export function getSourceAdapters(): SourceAdapter[] {
  return [
    new WorldBankAdapter(),
    new StubSourceAdapter("un_comtrade", "UN Comtrade adapter placeholder; do not emit trade metrics until implemented."),
    new StubSourceAdapter("unodc", "UNODC adapter placeholder; crime metrics require official definitions and source metadata."),
    new StubSourceAdapter("vdem", "V-Dem adapter placeholder; democracy metrics require dataset version metadata."),
    new StubSourceAdapter("un_desa_migrant_stock", "UN DESA adapter placeholder; migration metrics require dataset release metadata."),
    new StubSourceAdapter("wipo", "WIPO adapter placeholder; patent metrics require WIPO raw archival."),
    new StubSourceAdapter("world_values_survey", "WVS adapter placeholder; survey metrics require sample size and question wording."),
    new StubSourceAdapter("oecd_pisa", "OECD PISA adapter placeholder; education metrics require assessment year metadata."),
    new StubSourceAdapter("unesco_uis", "UNESCO UIS adapter placeholder; education indicators require UIS source mapping."),
    new StubSourceAdapter("unctad", "UNCTAD adapter placeholder; trade/development indicators require source mapping."),
  ];
}

export function getSourceAdapter(sourceId: string): SourceAdapter | null {
  return getSourceAdapters().find((adapter) => adapter.sourceId === sourceId) ?? null;
}
