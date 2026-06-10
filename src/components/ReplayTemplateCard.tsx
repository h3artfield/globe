import type { ReplayTemplate } from "@/types/forecasting";
import { formatReplayQuestion } from "@/lib/forecasting/formatReplayQuestion";

function formatResolutionRule(spec: ReplayTemplate["resolution_spec"]): string {
  if (spec.kind === "metric_compare_years") {
    const aggregate = spec.aggregate ? ` (${spec.aggregate})` : "";
    const relationship = spec.relationship_id ? ` for ${spec.relationship_id}` : "";
    return `${spec.source_id} · ${spec.metric_id}${relationship}: compare as_of baseline year vs ${spec.resolution_year} (${spec.comparator})${aggregate}`;
  }
  if (spec.kind === "metric_threshold") {
    return `${spec.source_id} · ${spec.metric_id} at year ${spec.year} ${spec.comparator} ${spec.threshold}`;
  }
  if (spec.kind === "polymarket_market_outcome") {
    const endDate = spec.end_date ? ` by ${spec.end_date}` : "";
    return `Polymarket market ${spec.market_id}${endDate} · ${spec.resolution_source}`;
  }
  return `${spec.source_id} · event "${spec.event_type}" between ${spec.window_start} and ${spec.window_end}`;
}

type ReplayTemplateCardProps = {
  template: ReplayTemplate;
};

export function ReplayTemplateCard({ template }: ReplayTemplateCardProps) {
  const exampleTarget = template.allowed_targets[0] ?? "—";
  const exampleQuestion = formatReplayQuestion(template, exampleTarget);
  const targetLabel = template.target_type === "relationship" ? "Relationships" : "Countries";

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{template.title}</h3>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {template.target_type}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{template.description}</p>
      <p className="mt-3 text-xs text-slate-500">
        <code>{template.template_id}</code> · v{template.version} · {template.mode}
      </p>

      <details className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-cyan-200 hover:text-cyan-100">
          Template details
        </summary>
        <div className="space-y-4 border-t border-slate-700 px-4 py-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Question preview</p>
            <p className="mt-1 leading-6 text-slate-300 italic">{exampleQuestion}</p>
            <p className="mt-1 text-xs text-slate-500">
              Preview uses first allowed target ({exampleTarget}) and default years.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Resolution source / rule</p>
            <p className="mt-1 text-slate-300">{formatResolutionRule(template.resolution_spec)}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
              {JSON.stringify(template.resolution_spec, null, 2)}
            </pre>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{targetLabel}</dt>
              <dd>{template.allowed_targets.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Years</dt>
              <dd>
                as_of {template.default_as_of_year} → resolution {template.resolution_year}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Allowed source IDs</dt>
              <dd>{template.allowed_source_ids.join(", ")}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Allowed evidence sources</dt>
              <dd>{template.allowed_evidence_sources.join(", ")}</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Limitations</p>
            <p className="mt-1 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-100">
              {template.limitations}
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}
