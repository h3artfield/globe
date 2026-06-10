"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NewsEvidenceRecord, ReplayEvidenceSnapshot, ReplaySession } from "@/types/forecasting";

const GDELT_NEWS_SOURCE_ID = "gdelt_news_events";

type ReplaySessionNewsEvidenceProps = {
  session: ReplaySession;
  initialSnapshot: ReplayEvidenceSnapshot | null;
};

function confidenceBadgeClass(confidence: string): string {
  if (confidence === "high") {
    return "border-emerald-700 text-emerald-200";
  }
  if (confidence === "medium") {
    return "border-amber-700 text-amber-200";
  }
  return "border-rose-700 text-rose-200";
}

export function ReplaySessionNewsEvidence({
  session,
  initialSnapshot,
}: ReplaySessionNewsEvidenceProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ReplayEvidenceSnapshot | null>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const newsRecords = snapshot?.news_evidence_records ?? [];
  const canFindNews =
    (session.status === "draft" || session.status === "locked") &&
    session.allowed_source_ids.includes(GDELT_NEWS_SOURCE_ID);

  async function handleFindNewsEvidence() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/forecast/replay/sessions/${session.session_id}/news-evidence`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        attached_count?: number;
        total_news_records?: number;
        snapshot?: ReplayEvidenceSnapshot;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to find news evidence");
      }
      if (payload.snapshot) {
        setSnapshot(payload.snapshot);
      }
      setMessage(
        `Attached ${payload.attached_count ?? 0} news record(s); ${payload.total_news_records ?? 0} total in snapshot.`,
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to find news evidence");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">News Evidence (GDELT)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Local-first news intake for question support. Mock fixture by default; no paid APIs.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-sm text-violet-100 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canFindNews || loading}
          onClick={handleFindNewsEvidence}
        >
          {loading ? "Finding…" : "Find News Evidence"}
        </button>
      </div>

      {!canFindNews ? (
        <p className="mt-3 text-sm text-slate-500">
          GDELT news evidence is unavailable for this session status or allowed sources.
        </p>
      ) : null}

      <p className="mt-3 text-sm text-slate-300">
        Records in snapshot: <strong>{newsRecords.length}</strong>
      </p>

      {newsRecords.length > 0 ? (
        <ul className="mt-3 space-y-3 text-sm">
          {newsRecords.map((record: NewsEvidenceRecord) => (
            <li
              key={record.evidence_record_id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
            >
              <p className="font-medium text-cyan-200">{record.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {record.outlet} · {record.published_at.slice(0, 10)} · relevance=
                {Math.round(record.relevance_score * 100)}% · quality=
                {Math.round(record.source_quality_score * 100)}%
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${confidenceBadgeClass(record.confidence)}`}
                >
                  {record.confidence}
                </span>
                {record.country_iso3_list.map((country) => (
                  <span
                    key={`${record.evidence_record_id}-${country}`}
                    className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400"
                  >
                    {country}
                  </span>
                ))}
                {record.topics.slice(0, 3).map((topic) => (
                  <span
                    key={`${record.evidence_record_id}-${topic}`}
                    className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              {record.source_url ? (
                <a
                  className="mt-2 inline-block text-xs text-violet-300 hover:text-violet-100"
                  href={record.source_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  View source
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No GDELT news records attached yet. Use Find News Evidence to load mock/local records.
        </p>
      )}

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-cyan-300">{message}</p> : null}
    </section>
  );
}
