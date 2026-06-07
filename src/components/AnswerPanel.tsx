"use client";

import type { AskResponse } from "@/types/api";

type AnswerPanelProps = {
  answer: AskResponse | null;
  error: string | null;
};

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
        {items.length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>None listed.</li>}
      </ul>
    </div>
  );
}

export function AnswerPanel({ answer, error }: AnswerPanelProps) {
  if (error) {
    return (
      <section className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-100">
        {error}
      </section>
    );
  }

  if (!answer) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-sm text-slate-400 shadow-xl backdrop-blur">
        Answers will appear here after you ask a question.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Answer</p>
          <h2 className="text-lg font-semibold text-white">Strategic response</h2>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          Confidence: {answer.confidence}
        </span>
      </div>

      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-900/80 p-4 text-sm leading-6 text-slate-200">
        {answer.answer}
      </pre>
      <button
        type="button"
        onClick={() => {
          fetch("/api/audits/answers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: answer.answer.split("\n")[0]?.replace("Question: ", "") ?? "",
              selectedCountries: answer.selectedCountries,
              response: answer,
            }),
          });
        }}
        className="mt-3 rounded-lg border border-cyan-500/60 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10"
      >
        Save Answer Audit
      </button>

      <div className="mt-5 grid gap-4">
        <ListSection title="Key incentives" items={answer.strategicSummary.mainIncentives} />
        <ListSection title="Key constraints" items={answer.strategicSummary.mainConstraints} />
        <ListSection title="Likely moves" items={answer.strategicSummary.likelyMoves} />
        <ListSection title="Escalation risks" items={answer.strategicSummary.escalationRisks} />
        <ListSection
          title="Deescalation options"
          items={answer.strategicSummary.deescalationOptions}
        />
        <ListSection title="Missing data" items={answer.missingData} />
        <ListSection title="Sources used" items={answer.sourceIds} />
        <ListSection title="Review status" items={answer.review_statuses ?? []} />
        <ListSection title="Warning badges" items={answer.warning_badges ?? []} />
        <ListSection title="Modules used" items={answer.modules_used ?? []} />
        <ListSection
          title="Chunks used"
          items={(answer.chunks_used ?? []).map((chunk) => `${chunk.chunk_id} (${chunk.module})`)}
        />
        <ListSection
          title="Metrics used"
          items={(answer.metrics_used ?? []).map(
            (metric) => `${metric.country_code}.${metric.metric_id} (${metric.year ?? "year unknown"})`,
          )}
        />
        <ListSection
          title="Citations"
          items={(answer.citations ?? []).map(
            (citation) =>
              `${citation.source_id}${citation.chunk_id ? ` / ${citation.chunk_id}` : ""}${citation.metric_id ? ` / ${citation.metric_id}` : ""}`,
          )}
        />
        {answer.retrieval_debug ? (
          <details className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              Retrieval debug
            </summary>
            <div className="mt-3 space-y-3 text-xs text-slate-300">
              <ListSection title="Retrieved chunks" items={answer.retrieval_debug.final_chunks} />
              <ListSection
                title="Dropped candidates"
                items={answer.retrieval_debug.dropped_candidates.slice(0, 20)}
              />
              <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3">
                {JSON.stringify(answer.retrieval_debug.scoring_breakdown, null, 2)}
              </pre>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
