import type { Metadata } from "next";
import Link from "next/link";
import { loadKbStatusSnapshot } from "@/lib/kb/loadKbStatusSnapshot";

export const metadata: Metadata = {
  title: "About & Status | 3D Country RAG Globe",
  description:
    "What this local geopolitical RAG globe does today, what data is loaded, current limitations, and the forecasting sandbox direction.",
};

function formatReadiness(score: number): string {
  return score.toFixed(2);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
    </section>
  );
}

function CommandList({ commands }: { commands: string[] }) {
  return (
    <ul className="space-y-2">
      {commands.map((command) => (
        <li key={command}>
          <code className="block rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-cyan-200">
            {command}
          </code>
        </li>
      ))}
    </ul>
  );
}

export default async function AboutPage() {
  const snapshot = await loadKbStatusSnapshot();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0,#020617_40%,#000_100%)] p-4 text-white md:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                MVP / partial coverage
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                About &amp; Status
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Local file-based geopolitical country and relationship RAG globe — becoming an
                evidence-based forecasting sandbox. Runtime data lives under <code>data/</code> as
                JSON, JSONL, and Markdown. There is no external database.
              </p>
            </div>
            <nav className="flex shrink-0 flex-wrap gap-3 text-sm">
              <Link className="text-cyan-300 hover:text-cyan-100" href="/">
                Globe
              </Link>
              <Link className="text-cyan-300 hover:text-cyan-100" href="/review">
                Review
              </Link>
            </nav>
          </div>
          <p className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            Coverage is intentionally partial. Missing modules and thin relationship readiness are
            expected at this stage — not a production intelligence product.
          </p>
        </header>

        <Section title="What this app is today">
          <p>
            A local Next.js app with a 3D globe for selecting MVP countries and asking strategic
            questions grounded in on-disk RAG artifacts. Answers are retrieved from structured country
            and relationship profiles, processed metrics, and vector chunks — not from live web
            scraping at query time.
          </p>
          <p>
            The pilot tracks {snapshot.summary.countriesTracked} MVP countries and{" "}
            {snapshot.summary.relationshipsTracked} bilateral relationships. Select countries on the
            globe to inspect RAG file presence and ask questions within current coverage limits.
          </p>
          <p>
            <strong className="font-medium text-slate-100">USA</strong> and{" "}
            <strong className="font-medium text-slate-100">CHN</strong> are the strongest country
            targets today. Relationship readiness remains lower across the board because treaties,
            sanctions, UN voting alignment, and ACLED-style event timelines are still incomplete.
          </p>
        </Section>

        <Section title="What the knowledge base contains">
          <p>The app reads local RAG and pipeline artifacts from:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>data/rag/countries/&#123;ISO3&#125;/</code> — country profiles and chunks
            </li>
            <li>
              <code>data/rag/relationships/&#123;A_B&#125;/</code> — bilateral relationship
              profiles
            </li>
            <li>
              <code>data/vector/</code> — embedding indexes for retrieval
            </li>
            <li>
              <code>data/world_model/</code> — graph and structured world-model outputs
            </li>
            <li>
              <code>data/processed/</code> — normalized metrics, events, and module inputs
            </li>
          </ul>
          <p>
            On disk now: {snapshot.ragArtifactCounts.countryDirs} country RAG directories and{" "}
            {snapshot.ragArtifactCounts.relationshipDirs} relationship RAG directories under{" "}
            <code>data/rag/</code>.
          </p>
        </Section>

        <Section title="Current knowledge base sources">
          <p>
            Batch 1 shared structured sources: {snapshot.batch1.importedCount} of{" "}
            {snapshot.batch1.totalCount} imported into canonical{" "}
            <code>data/manual_imports/</code> (transformers implemented for all{" "}
            {snapshot.batch1.totalCount}).
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>V-Dem — democracy and governance indicators</li>
            <li>UCDP — conflict events</li>
            <li>Correlates of War — alliances and interstate war history</li>
            <li>UN Comtrade — bilateral trade totals</li>
            <li>UNODC — intentional homicide metrics</li>
            <li>UNESCO UIS — education and literacy where available</li>
            <li>WIPO — patent-family metrics</li>
            <li>UNCTAD — trade openness and shipping connectivity</li>
            <li>World Values Survey — trust, national pride, willingness-to-fight style surveys</li>
            <li>OECD PISA — national mean scores where countries appear in source annexes</li>
          </ul>
          <p>
            <strong className="font-medium text-amber-200">ACLED</strong> — transformer is
            implemented, but collection is blocked because export access is blocked at the current
            account level. Retry when access changes.
          </p>
          <p>Manual or shared sources still needed:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>treaties_manual</code>
            </li>
            <li>
              <code>sanctions_manual</code>
            </li>
            <li>
              <code>un_voting_alignment</code>
            </li>
          </ul>
          {snapshot.sharedQueue.length > 0 ? (
            <details className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <summary className="cursor-pointer text-slate-200">
                Shared source queue ({snapshot.sharedQueue.length} entries from disk)
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {snapshot.sharedQueue.map((item) => (
                  <li key={item.queueId}>
                    {item.queueId}: {item.status}
                    {item.title ? ` — ${item.title}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Section>

        <Section title="What the software can currently answer">
          <p>Stronger today on country-level and metric-backed questions, including:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Country-level metrics and scorecard-style comparisons</li>
            <li>Democracy and governance indicators (V-Dem)</li>
            <li>Trade and UN Comtrade bilateral totals</li>
            <li>UNODC homicide metrics</li>
            <li>Education, literacy, and OECD PISA where source coverage exists</li>
            <li>WIPO patent-family metrics</li>
            <li>UNCTAD trade openness and shipping connectivity</li>
            <li>
              WVS trust, national pride, and willingness-to-fight style survey metrics for covered
              countries
            </li>
            <li>UCDP and COW relationship conflict, alliance, and war-history events</li>
          </ul>
          <p>
            Relationship readiness remains lower than country readiness because treaty, sanctions,
            diplomatic narrative, and ACLED-style event timelines are not complete.
          </p>
        </Section>

        <Section title="Current limitations">
          <p>Do not treat this as complete intelligence coverage.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Many narrative modules are still stub or partial</li>
            <li>Relationship pairs lack full treaty, sanctions, and diplomatic depth</li>
            <li>ACLED event export is not loaded</li>
            <li>Answers depend on which modules and sources exist for the selected countries</li>
            <li>Freshness and provenance warnings are expected during pipeline validation</li>
          </ul>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Readiness snapshot</p>
            {snapshot.loadedFromDisk ? (
              <p className="mt-1 text-xs text-slate-500">
                Loaded from local reports
                {snapshot.generatedAt ? ` · matrix generated ${snapshot.generatedAt}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Static fallback values (reports not found)</p>
            )}
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Average country readiness</dt>
                <dd className="text-lg font-semibold text-white">
                  {formatReadiness(snapshot.summary.averageCountryReadiness)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Average relationship readiness</dt>
                <dd className="text-lg font-semibold text-white">
                  {formatReadiness(snapshot.summary.averageRelationshipReadiness)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Top country readiness</dt>
                <dd>
                  {snapshot.topCountries.map((entry) => (
                    <span key={entry.id} className="mr-3">
                      {entry.id} {formatReadiness(entry.readiness)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Top relationship readiness</dt>
                <dd>
                  {snapshot.topRelationships.map((entry) => (
                    <span key={entry.id} className="mr-3">
                      {entry.id} {formatReadiness(entry.readiness)}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-400">Lowest relationship readiness</dt>
                <dd>
                  {snapshot.lowestRelationships.map((entry) => (
                    <span key={entry.id} className="mr-3">
                      {entry.id} {formatReadiness(entry.readiness)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Queue items still needed</dt>
                <dd>{snapshot.summary.queueItemsNeeded}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Shared datasets still needed</dt>
                <dd>{snapshot.summary.sharedDatasetsNeeded}</dd>
              </div>
            </dl>
          </div>
        </Section>

        <Section title="Forecasting game direction">
          <p>
            The app is becoming a <strong className="font-medium text-slate-100">probabilistic
            forecasting sandbox</strong> — a forecast replay game, not a prophecy engine. The player
            runs a geopolitical forecasting agency whose job is to build, test, and improve a
            forecasting machine: gather evidence, submit calibrated probabilities, compare to resolved
            outcomes, and learn from postmortems.
          </p>
          <p>
            This app <strong className="font-medium text-amber-200">does not predict the future</strong>.
            It scores forecast quality against known or eventual outcomes in a local training
            environment.
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            Planning docs (not yet implemented in the UI):{" "}
            <code>docs/FORECASTING_GAME_DESIGN.md</code>,{" "}
            <code>docs/FORECASTING_TECHNICAL_PLAN.md</code>
          </p>
          <p className="text-amber-100">
            Forecast Lab gameplay is not implemented yet. The globe and Ask flow remain the current
            product surface.
          </p>
        </Section>

        <Section title="Historical Replay Mode (planned first game mode)">
          <p>
            The first playable mode will be <strong className="font-medium text-slate-100">Historical
            Replay</strong>: choose a country or bilateral relationship, set an{" "}
            <code>as_of_year</code> / <code>as_of_date</code> cutoff, gather only evidence that existed
            before that date, and submit a probabilistic forecast about an outcome already known in
            later historical data. The system reveals the hidden outcome immediately and scores the
            forecast.
          </p>
          <p>Example replay question:</p>
          <blockquote className="border-l-2 border-cyan-700 pl-3 text-slate-400 italic">
            As of 2020, will China–USA bilateral trade be higher in 2024 than in 2020?
          </blockquote>
          <p>
            Allowed evidence at first: structured metrics and dated events from{" "}
            <code>data/processed/</code> and <code>data/world_model/events/</code> (V-Dem, Comtrade,
            UCDP, COW, etc.) filtered to the cutoff. Resolution uses holdout data the player cannot
            see until submission.
          </p>
          <p>
            Later modes (not in first slice): Live Mode for real future forecasts, and Short-Cycle
            Operational Mode for hours/days/weeks resolution — eventually with a GDELT/news-organizer
            pipeline. Neither is built yet.
          </p>
        </Section>

        <Section title="No-leak rule (replay)">
          <p>
            Historical Replay must never accidentally use future knowledge. Every submitted forecast
            will run a leakage audit recording:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code>newest_evidence_date_used</code>
            </li>
            <li>
              <code>evidence_count</code>
            </li>
            <li>
              <code>rejected_future_evidence_count</code>
            </li>
            <li>
              <code>leakage_status</code>: <code>passed</code> | <code>failed</code>
            </li>
          </ul>
          <p>Replay retrieval rules (planned):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Structured metrics: include only rows where <code>year &lt;= as_of_year</code></li>
            <li>World-model events: include only where <code>event_date &lt;= as_of_date</code></li>
            <li>
              Do <strong className="font-medium text-amber-200">not</strong> use future news, RAG
              prose summaries, Wikipedia summaries, top-events summaries, news_memory, or unconstrained
              chunk/embedding retrieval until each artifact carries a safe provenance date and passes
              cutoff filtering
            </li>
          </ul>
          <p>
            Forecasts will be scored with the <strong className="font-medium text-slate-100">Brier
            score</strong> first (<code>(p - outcome)²</code>). Calibration curves and agent ELO come
            later.
          </p>
        </Section>

        <Section title="Local architecture">
          <ul className="list-disc space-y-1 pl-5">
            <li>Next.js app under <code>src/app/</code> with API routes for ask, RAG status, and pilots</li>
            <li>Batch 1 transformers under <code>src/lib/kb/batch1Transform/</code></li>
            <li>Canonical imports in <code>data/manual_imports/</code>; raw staging in{" "}
              <code>data/manual_imports_raw/</code>
            </li>
            <li>Pipeline scripts under <code>scripts/kb/</code> and <code>scripts/pipeline/</code></li>
            <li>Embeddings and retrieval over local vector files — no cloud KB at runtime</li>
            <li>
              Forecasting artifacts (planned) under <code>data/forecasting/</code> — templates,
              sessions, resolutions, audits, scorecards — all file-based, no external database
            </li>
          </ul>
        </Section>

        <Section title="Rebuild / status commands">
          <p>Run from the repository root:</p>
          <CommandList
            commands={[
              "npm run kb:status",
              "npm run pipeline:validate",
              "npm run embeddings:build:mvp",
              "npm run kb:matrix",
              "npm run kb:queue",
            ]}
          />
          <p>
            Use <code>npm run kb:transform-batch1 -- --source &lt;source_ingest_id&gt;</code> after
            placing raw files under <code>data/manual_imports_raw/</code>. Check receipts with{" "}
            <code>npm run kb:receipts</code>.
          </p>
        </Section>

        <Section title="Next priorities">
          <p className="font-medium text-slate-100">Knowledge base collection</p>
          <p className="text-slate-400">Focus areas that unlock the biggest readiness gaps:</p>
          <ol className="list-decimal space-y-2 pl-5">
            {snapshot.nextCollectionPriorities.map((entry) => (
              <li key={entry.queueId}>
                <span className="font-medium text-slate-100">{entry.queueId}</span>
                <span className="text-slate-400"> — {entry.rationale}</span>
              </li>
            ))}
          </ol>
          {snapshot.batch1.blockedSources.length > 0 ? (
            <p className="text-amber-100">
              Blocked:{" "}
              {snapshot.batch1.blockedSources
                .map((entry) => `${entry.id} (${entry.reason})`)
                .join("; ")}
            </p>
          ) : null}
          <p className="mt-4 font-medium text-slate-100">Forecasting sandbox implementation</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <span className="font-medium text-slate-100">Phase 0</span>
              <span className="text-slate-400"> — planning docs (done)</span>
            </li>
            <li>
              <span className="font-medium text-slate-100">Phase 1</span>
              <span className="text-slate-400"> — static replay templates and /forecast/replay shell</span>
            </li>
            <li>
              <span className="font-medium text-slate-100">Phase 2</span>
              <span className="text-slate-400"> — cutoff-safe structured evidence retrieval + leakage audit</span>
            </li>
            <li>
              <span className="font-medium text-slate-100">Phase 3</span>
              <span className="text-slate-400"> — forecast submission, resolution reveal, Brier scoring</span>
            </li>
            <li>
              <span className="font-medium text-slate-100">Phase 4+</span>
              <span className="text-slate-400"> — postmortems, scorecards, GDELT organizer, agent ELO (later)</span>
            </li>
          </ol>
        </Section>
      </div>
    </main>
  );
}
