import type { SourceAdapter } from "../SourceAdapter";
import { ManualFileAdapter } from "./manualFileAdapter";
import { StubSourceAdapter } from "./stubAdapter";
import { WikipediaBaselineAdapter } from "./wikipediaBaselineAdapter";
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
    new StubSourceAdapter("gdelt", "GDELT world-model adapter scaffold. Use manual imports or implement configured API fetch before emitting events."),
    new StubSourceAdapter("acled", "ACLED world-model adapter scaffold. Manual import/API credentials required before emitting events."),
    new StubSourceAdapter("ucdp", "UCDP world-model adapter scaffold. Manual import required before emitting conflict events."),
    new StubSourceAdapter("correlates_of_war", "Correlates of War adapter scaffold for historical wars and alliances."),
    new StubSourceAdapter("un_voting", "UN voting adapter scaffold for diplomatic support graphs."),
    new StubSourceAdapter("sanctions", "Sanctions adapter scaffold for sanctions relationships."),
    new StubSourceAdapter("treaties_manual", "Manual treaty adapter scaffold for alliances and defense pacts."),
    new StubSourceAdapter("news_manual", "Manual news adapter scaffold for verified event timelines."),
    new WikipediaBaselineAdapter(),
    new StubSourceAdapter("future_source_stub", "Reserved placeholder for future source adapters."),
  ];
}

export function getSourceAdapter(sourceId: string): SourceAdapter | null {
  return getSourceAdapters().find((adapter) => adapter.sourceId === sourceId) ?? null;
}
