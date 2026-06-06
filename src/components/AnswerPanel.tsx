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
      </div>
    </section>
  );
}
