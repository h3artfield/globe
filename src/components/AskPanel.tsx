"use client";

import { FormEvent, useState } from "react";
import { LoadingState } from "./LoadingState";

type AskPanelProps = {
  disabled: boolean;
  isLoading: boolean;
  onAsk: (question: string) => Promise<void>;
};

export function AskPanel({ disabled, isLoading, onAsk }: AskPanelProps) {
  const [question, setQuestion] = useState(
    "What happens if Egypt and Ethiopia escalate over Nile water rights?",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    await onAsk(trimmedQuestion);
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 shadow-xl backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ask</p>
      <h2 className="mt-1 text-lg font-semibold text-white">Strategic question</h2>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={5}
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none ring-cyan-500/40 placeholder:text-slate-500 focus:ring-2"
          placeholder="Ask about incentives, risks, leverage, likely moves, or missing data..."
        />
        <button
          type="submit"
          disabled={disabled || isLoading}
          className="w-full rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {disabled ? "Select at least one country" : "Ask with selected context"}
        </button>
      </form>
      {isLoading ? <div className="mt-3"><LoadingState label="Building RAG context" /></div> : null}
    </section>
  );
}
