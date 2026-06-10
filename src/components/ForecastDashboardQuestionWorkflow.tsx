"use client";

import Link from "next/link";
import type {
  DashboardFetchModeInfo,
  DashboardQuestionWorkflow,
  DashboardWorkflowStep,
  DashboardWorkflowStepId,
} from "@/types/forecasting";

type QuestionWorkflowPanelProps = {
  workflow: DashboardQuestionWorkflow | null;
  busy: boolean;
  fetchModes: DashboardFetchModeInfo[];
  onRunStep: (stepId: DashboardWorkflowStepId) => Promise<void>;
};

function stepBadgeClass(state: DashboardWorkflowStep["state"]): string {
  if (state === "completed") {
    return "border-emerald-700 text-emerald-200 bg-emerald-950/30";
  }
  if (state === "available") {
    return "border-cyan-700 text-cyan-200 bg-cyan-950/30";
  }
  return "border-slate-700 text-slate-400 bg-slate-900/50";
}

export function ForecastDashboardQuestionWorkflow({
  workflow,
  busy,
  fetchModes,
  onRunStep,
}: QuestionWorkflowPanelProps) {
  if (!workflow) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        Select a Polymarket question below to start the guided operator workflow.
      </p>
    );
  }

  const polymarketMode = fetchModes.find((mode) => mode.source === "polymarket");
  const gdeltMode = fetchModes.find((mode) => mode.source === "gdelt");

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
          {polymarketMode?.label ?? "Polymarket mode unknown"}
        </span>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
          {gdeltMode?.label ?? "GDELT mode unknown"}
        </span>
      </div>

      <p className="text-sm text-slate-300">
        Guided flow for <strong className="text-cyan-200">{workflow.title}</strong>
        {workflow.session_id ? (
          <>
            {" "}
            ·{" "}
            <Link className="text-cyan-300 hover:text-cyan-100" href={`/forecast/replay/${workflow.session_id}`}>
              open session
            </Link>
          </>
        ) : null}
      </p>

      <ol className="space-y-3">
        {workflow.steps.map((step, index) => (
          <li
            key={step.step_id}
            className={`rounded-lg border p-3 text-sm ${stepBadgeClass(step.state)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {index + 1}. {step.label}{" "}
                  <span className="text-xs uppercase tracking-wide opacity-80">({step.state})</span>
                </p>
                {step.blocked_reason ? (
                  <p className="mt-1 text-xs text-amber-200/90">Blocked: {step.blocked_reason}</p>
                ) : null}
                {step.last_result_summary ? (
                  <p className="mt-1 text-xs text-slate-300">{step.last_result_summary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {step.session_url ? (
                  <Link className="text-xs text-cyan-300 hover:text-cyan-100" href={step.session_url}>
                    Session detail
                  </Link>
                ) : null}
                {step.state === "available" ? (
                  <button
                    type="button"
                    className="rounded border border-cyan-700 px-2 py-1 text-xs disabled:opacity-50"
                    disabled={busy}
                    onClick={() => onRunStep(step.step_id)}
                  >
                    Run
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FetchModeBanner({ fetchModes }: { fetchModes: DashboardFetchModeInfo[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {fetchModes.map((mode) => (
        <span
          key={mode.source}
          className={`rounded-full border px-3 py-1 text-xs ${
            mode.live_fetch_allowed
              ? "border-emerald-700 text-emerald-200"
              : "border-amber-700 text-amber-200"
          }`}
          title={mode.env_hint}
        >
          {mode.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyStatePanel({
  emptyStates,
}: {
  emptyStates: Array<{ id: string; message: string; next_action: string }>;
}) {
  if (emptyStates.length === 0) {
    return null;
  }
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <h2 className="text-lg font-semibold">Getting Started</h2>
      <ul className="mt-3 space-y-3 text-sm">
        {emptyStates.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-slate-200">{item.message}</p>
            <p className="mt-1 text-xs text-cyan-300">{item.next_action}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
