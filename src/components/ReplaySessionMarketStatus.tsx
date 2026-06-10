"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  ForecastQuestionSourceMarket,
  PolymarketMarketRefresh,
  ReplaySession,
} from "@/types/forecasting";

type ReplaySessionMarketStatusProps = {
  session: ReplaySession;
  initialQuestion: ForecastQuestionSourceMarket | null;
  initialRefresh: PolymarketMarketRefresh | null;
};

function statusBadgeClass(status: string): string {
  if (status === "resolved") {
    return "border-emerald-700 text-emerald-200";
  }
  if (status === "open") {
    return "border-cyan-700 text-cyan-200";
  }
  if (status === "closed") {
    return "border-amber-700 text-amber-200";
  }
  return "border-slate-700 text-slate-300";
}

export function ReplaySessionMarketStatus({
  session,
  initialQuestion,
  initialRefresh,
}: ReplaySessionMarketStatusProps) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [refresh, setRefresh] = useState(initialRefresh);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"refresh" | "resolve" | null>(null);

  const isPolymarketLive =
    session.forecast_mode === "live" &&
    session.external_source === "polymarket" &&
    Boolean(session.source_market_id || session.external_source_url);

  const canRefresh = isPolymarketLive && (session.status === "draft" || session.status === "locked");
  const canResolve = isPolymarketLive && session.status === "locked";
  const resolvable = useMemo(() => {
    const status = question?.resolution_status ?? refresh?.resolution_status;
    return status === "resolved" && Boolean(question?.winning_outcome ?? refresh?.winning_outcome);
  }, [question, refresh]);

  async function handleRefreshMarket() {
    setError(null);
    setMessage(null);
    setLoadingAction("refresh");
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/refresh-market`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        question?: ForecastQuestionSourceMarket;
        refresh?: PolymarketMarketRefresh;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to refresh market");
      }
      if (payload.question) {
        setQuestion(payload.question);
      }
      if (payload.refresh) {
        setRefresh(payload.refresh);
      }
      setMessage("Market metadata refreshed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to refresh market");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleResolveFromMarket() {
    setError(null);
    setMessage(null);
    setLoadingAction("resolve");
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/resolve-from-market`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        resolved?: boolean;
        message?: string;
        refresh?: PolymarketMarketRefresh;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to resolve from market");
      }
      if (payload.refresh) {
        setRefresh(payload.refresh);
      }
      if (payload.resolved) {
        setMessage(payload.message ?? "Session resolved from Polymarket market.");
      } else {
        setMessage(payload.message ?? "not resolved yet");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to resolve from market");
    } finally {
      setLoadingAction(null);
    }
  }

  if (!isPolymarketLive) {
    return null;
  }

  const impliedProbability = question?.implied_probability ?? refresh?.implied_probability;
  const marketStatus = question?.resolution_status ?? refresh?.market_status ?? "unknown";
  const lastRefreshed = question?.last_refreshed_at ?? refresh?.fetched_at ?? null;
  const sourceUrl = session.external_source_url ?? question?.source_url ?? refresh?.source_url;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Market Status (Polymarket)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live market metadata refresh and resolution tracking. Mock by default.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-cyan-700 bg-cyan-950/50 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canRefresh || loadingAction !== null}
            onClick={handleRefreshMarket}
          >
            {loadingAction === "refresh" ? "Refreshing…" : "Refresh Market"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canResolve || !resolvable || loadingAction !== null}
            onClick={handleResolveFromMarket}
          >
            {loadingAction === "resolve" ? "Resolving…" : "Resolve From Market"}
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Source market</dt>
          <dd>
            {sourceUrl ? (
              <a className="text-violet-300 hover:text-violet-100" href={sourceUrl} rel="noreferrer" target="_blank">
                {sourceUrl}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Implied probability</dt>
          <dd>
            {impliedProbability != null ? `${Math.round(impliedProbability * 100)}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Market status</dt>
          <dd>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(marketStatus)}`}>
              {marketStatus}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Volume / liquidity</dt>
          <dd>
            {question?.volume ?? refresh?.volume ?? "—"} / {question?.liquidity ?? refresh?.liquidity ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">End date</dt>
          <dd>{question?.end_date ?? refresh?.end_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Last refreshed</dt>
          <dd>{lastRefreshed ? new Date(lastRefreshed).toLocaleString() : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Outcome prices</dt>
          <dd>
            {(question?.outcomes ?? refresh?.outcomes ?? []).map((outcome, index) => (
              <span key={outcome} className="mr-3 inline-block text-slate-300">
                {outcome}: {question?.outcome_prices?.[index] ?? refresh?.outcome_prices?.[index] ?? "—"}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Resolution status</dt>
          <dd>{question?.resolution_status ?? refresh?.resolution_status ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Winning outcome</dt>
          <dd>{question?.winning_outcome ?? refresh?.winning_outcome ?? "—"}</dd>
        </div>
      </dl>

      {!canResolve ? (
        <p className="mt-3 text-sm text-slate-500">
          Resolve From Market is available after the forecast is locked.
        </p>
      ) : !resolvable ? (
        <p className="mt-3 text-sm text-slate-500">
          Market is not resolved yet. Refresh after the market closes.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-cyan-300">{message}</p> : null}
    </section>
  );
}
