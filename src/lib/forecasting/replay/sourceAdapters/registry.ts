import type { ReplaySession } from "@/types/forecasting";
import { gdeltNewsEventsAdapter } from "@/lib/forecasting/replay/sourceAdapters/gdeltNewsEventsAdapter";
import { unComtradeBilateralAdapter } from "@/lib/forecasting/replay/sourceAdapters/unComtradeBilateralAdapter";
import { ucdpAdapter } from "@/lib/forecasting/replay/sourceAdapters/ucdpAdapter";
import { unodcAdapter } from "@/lib/forecasting/replay/sourceAdapters/unodcAdapter";
import { vdemAdapter } from "@/lib/forecasting/replay/sourceAdapters/vdemAdapter";
import { wvsAdapter } from "@/lib/forecasting/replay/sourceAdapters/wvsAdapter";
import type { ReplaySourceAdapter } from "@/lib/forecasting/replay/sourceAdapters/types";

const ADAPTERS: ReplaySourceAdapter[] = [
  unComtradeBilateralAdapter,
  vdemAdapter,
  ucdpAdapter,
  unodcAdapter,
  wvsAdapter,
  gdeltNewsEventsAdapter,
];

const ADAPTER_BY_SOURCE_ID = new Map(ADAPTERS.map((adapter) => [adapter.source_id, adapter]));

/** Maps template allowed_source_ids to adapter source_id keys. */
const SOURCE_ID_ALIASES: Record<string, string> = {
  un_comtrade: "un_comtrade_bilateral",
  world_values_survey: "wvs",
};

export function resolveAdapterSourceId(sourceId: string): string {
  return SOURCE_ID_ALIASES[sourceId] ?? sourceId;
}

export function getReplaySourceAdapter(sourceId: string): ReplaySourceAdapter | null {
  return ADAPTER_BY_SOURCE_ID.get(resolveAdapterSourceId(sourceId)) ?? null;
}

export function getReplaySourceAdaptersForSession(session: ReplaySession): ReplaySourceAdapter[] {
  const adapters: ReplaySourceAdapter[] = [];
  for (const sourceId of session.allowed_source_ids) {
    const adapter = getReplaySourceAdapter(sourceId);
    if (adapter && !adapters.includes(adapter)) {
      adapters.push(adapter);
    }
  }
  return adapters;
}

export function getPrimaryResolutionAdapter(session: ReplaySession): ReplaySourceAdapter | null {
  const spec = session.resolution_spec;
  if (spec.kind === "metric_compare_years" || spec.kind === "metric_threshold") {
    return getReplaySourceAdapter(spec.source_id);
  }
  if (spec.kind === "event_exists") {
    return getReplaySourceAdapter(spec.source_id);
  }
  return null;
}
