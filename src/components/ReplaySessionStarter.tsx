"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReplayTemplate } from "@/types/forecasting";

type ReplaySessionStarterProps = {
  templates: ReplayTemplate[];
};

export function ReplaySessionStarter({ templates }: ReplaySessionStarterProps) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.template_id ?? "");
  const [target, setTarget] = useState(templates[0]?.allowed_targets[0] ?? "");
  const [year, setYear] = useState(templates[0]?.default_as_of_year ?? 2020);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.template_id === templateId) ?? null,
    [templateId, templates],
  );

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const template = templates.find((entry) => entry.template_id === nextTemplateId);
    if (!template) {
      return;
    }
    setTarget(template.allowed_targets[0] ?? "");
    setYear(template.default_as_of_year);
    setError(null);
  }

  async function handleStartSession() {
    if (!selectedTemplate) {
      setError("Select a template first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/forecast/replay/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          target,
          year,
        }),
      });

      const payload = (await response.json()) as { session_id?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to create session (${response.status})`);
      }
      if (!payload.session_id) {
        throw new Error("Session created but session_id missing from response");
      }

      router.push(`/forecast/replay/${payload.session_id}`);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to create session.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <h2 className="text-lg font-semibold tracking-tight text-white">Start replay session</h2>
      <p className="mt-2 text-sm text-slate-400">
        Choose a template, target, and as_of year. The session is saved locally under{" "}
        <code>data/forecasting/sessions/</code>.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300 sm:col-span-2">
          Template
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            onChange={(event) => handleTemplateChange(event.target.value)}
            value={templateId}
          >
            {templates.map((template) => (
              <option key={template.template_id} value={template.template_id}>
                {template.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-300">
          Target
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            onChange={(event) => setTarget(event.target.value)}
            value={target}
          >
            {(selectedTemplate?.allowed_targets ?? []).map((targetId) => (
              <option key={targetId} value={targetId}>
                {targetId}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-slate-300">
          as_of_year
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            max={(selectedTemplate?.resolution_year ?? 2100) - 1}
            min={1900}
            onChange={(event) => setYear(Number(event.target.value))}
            type="number"
            value={year}
          />
        </label>
      </div>

      {selectedTemplate ? (
        <p className="mt-3 text-xs text-slate-500">
          Resolution year: {selectedTemplate.resolution_year}. Forecast year must be earlier.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <button
        className="mt-4 rounded-lg border border-cyan-700 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || !selectedTemplate}
        onClick={handleStartSession}
        type="button"
      >
        {isSubmitting ? "Creating session…" : "Start Replay Session"}
      </button>
    </section>
  );
}
