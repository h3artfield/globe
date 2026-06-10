import type { ForecastSourceRequest } from "@/types/forecasting";
import {
  gdeltNewsEventsAdapter,
  manualFileAdapter,
  ucdpFulfillmentAdapter,
  unComtradeFulfillmentAdapter,
  unodcFulfillmentAdapter,
  vdemFulfillmentAdapter,
  wvsFulfillmentAdapter,
  type SourceFulfillmentAdapter,
  type SourceFulfillmentInput,
} from "@/lib/forecasting/sourceFulfillment/types";

const ADAPTERS: SourceFulfillmentAdapter[] = [
  manualFileAdapter,
  gdeltNewsEventsAdapter,
  unComtradeFulfillmentAdapter,
  vdemFulfillmentAdapter,
  ucdpFulfillmentAdapter,
  unodcFulfillmentAdapter,
  wvsFulfillmentAdapter,
];

const ADAPTER_BY_ID = new Map(ADAPTERS.map((adapter) => [adapter.adapter_id, adapter]));

export function listSourceFulfillmentAdapters(): SourceFulfillmentAdapter[] {
  return ADAPTERS;
}

export function getSourceFulfillmentAdapter(adapterId: string): SourceFulfillmentAdapter | null {
  return ADAPTER_BY_ID.get(adapterId) ?? null;
}

export function findSourceFulfillmentAdapter(
  request: ForecastSourceRequest,
  input: SourceFulfillmentInput,
  preferredAdapterId?: string,
): SourceFulfillmentAdapter | null {
  if (preferredAdapterId) {
    const preferred = getSourceFulfillmentAdapter(preferredAdapterId);
    if (preferred?.canFulfill(request, input)) {
      return preferred;
    }
  }

  for (const adapter of ADAPTERS) {
    if (adapter.canFulfill(request, input)) {
      return adapter;
    }
  }
  return null;
}
