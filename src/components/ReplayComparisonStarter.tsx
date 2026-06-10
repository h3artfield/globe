"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReplayTemplate } from "@/types/forecasting";

type ReplayComparisonStarterProps = {
  templates: ReplayTemplate[];
};

export function ReplayComparisonStarter({ templates }: ReplayComparisonStarterProps) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.template_id ?? "");
  const [target, setTarget] = useState(templates[0]?.allowed_targets[0] ?? "");
  const [year, setYear] = useState(templates[0]?.default_as_of_year ?? 2020);
  const [agents, setAgents] = useState<Array<{ agent_id: string; name: string }>>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.template_id === templateId) ?? null,
    [templateId, templates],
  );

  useEffect(() => {
    void fetch("/api/forecast/agents")
      .then((response) => response.json())
      .then((payload: { agents: Array<{ agent_id: string; name: string }> }) => {
        setAgents(payload.agents ?? []);
        setSelectedAgents((payload.agents ?? []).slice(0, 2).map((agent) => agent.agent_id));
      });
  }, []);

  function toggleAgent(agentId: string) {
    setSelectedAgents((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId],
    );
  }

  async function handleCreateComparison() {
    if (selectedAgents.length < 2) {
      setError("Select at least two agents.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/forecast/replay/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          target,
          year,
          agent_ids: selectedAgents,
        }),
      });
      const payload = (await response.json()) as { comparison_group_id?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create comparison");
      }
      router.push(`/forecast/replay/comparisons/${payload.comparison_group_id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create comparison");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-violet-900/60 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <h2 className="text-lg font-semibold text-white">Agent Comparison Replay</h2>
      <p className="mt-2 text-sm text-slate-400">
        Same template, target, and as_of year for 2+ agents. Each agent gets an isolated session.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300 sm:col-span-2">
          Template
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2"
            onChange={(event) => {
              setTemplateId(event.target.value);
              const template = templates.find((item) => item.template_id === event.target.value);
              if (template) {
                setTarget(template.allowed_targets[0] ?? "");
                setYear(template.default_as_of_year);
              }
            }}
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
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2"
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
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2"
            onChange={(event) => setYear(Number(event.target.value))}
            type="number"
            value={year}
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-sm text-slate-300">Select agents (2+)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {agents.map((agent) => (
            <label
              key={agent.agent_id}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                selectedAgents.includes(agent.agent_id)
                  ? "border-violet-500 text-violet-200"
                  : "border-slate-700 text-slate-400"
              }`}
            >
              <input
                checked={selectedAgents.includes(agent.agent_id)}
                className="mr-1"
                onChange={() => toggleAgent(agent.agent_id)}
                type="checkbox"
              />
              {agent.name}
            </label>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <button
        type="button"
        className="mt-4 rounded-lg border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm text-violet-100 disabled:opacity-50"
        disabled={isSubmitting}
        onClick={handleCreateComparison}
      >
        {isSubmitting ? "Creating…" : "Create Comparison Replay"}
      </button>
    </section>
  );
}
