import type { DashboardFetchModeInfo } from "@/types/forecasting";
import { isGdeltLiveFetchAllowed, isGdeltMockMode } from "@/lib/forecasting/gdelt/gdeltNewsConfig";
import {
  isPolymarketLiveFetchAllowed,
  isPolymarketMockMode,
} from "@/lib/forecasting/polymarket/polymarketConfig";

export function getDashboardFetchModes(): DashboardFetchModeInfo[] {
  const polymarketLive = isPolymarketLiveFetchAllowed();
  const gdeltLive = isGdeltLiveFetchAllowed();
  const polymarketMock = isPolymarketMockMode();
  const gdeltMock = isGdeltMockMode();

  return [
    {
      source: "polymarket",
      mode: polymarketMock ? "mock" : "live",
      live_fetch_allowed: polymarketLive,
      label: polymarketMock
        ? polymarketLive
          ? "Polymarket: mock mode (POLYMARKET_USE_MOCK=true)"
          : "Polymarket: mock mode (live fetch disabled)"
        : "Polymarket: live fetch enabled",
      env_hint: polymarketLive
        ? "Set POLYMARKET_USE_MOCK=false to use live Gamma fetch."
        : "Set POLYMARKET_ALLOW_LIVE_FETCH=true to enable live fetch.",
    },
    {
      source: "gdelt",
      mode: gdeltMock ? "mock" : "live",
      live_fetch_allowed: gdeltLive,
      label: gdeltMock
        ? gdeltLive
          ? "GDELT: mock mode (GDELT_USE_MOCK=true)"
          : "GDELT: mock mode (live fetch disabled)"
        : "GDELT: live fetch enabled",
      env_hint: gdeltLive
        ? "Set GDELT_USE_MOCK=false to use live GDELT fetch."
        : "Set GDELT_ALLOW_LIVE_FETCH=true to enable live fetch.",
    },
  ];
}
