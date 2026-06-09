import type { Metadata } from "next";
import Link from "next/link";
import { loadKbStatusSnapshot } from "@/lib/kb/loadKbStatusSnapshot";

export const metadata: Metadata = {
  title: "About & KB Status | 3D Country RAG Globe",
  description:
    "What this local geopolitical RAG globe does today, what data is loaded, and what remains incomplete.",
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
                About &amp; Knowledge Base Status
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Local file-based geopolitical country and relationship RAG globe. Runtime data lives
                under <code>data/</code> as JSON, JSONL, and Markdown. There is no external database.
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

        <Section title="What this app is">
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

        <Section title="Current imported data sources">
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

        <Section title="What it can answer today">
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

        <Section title="Local architecture">
          <ul className="list-disc space-y-1 pl-5">
            <li>Next.js app under <code>src/app/</code> with API routes for ask, RAG status, and pilots</li>
            <li>Batch 1 transformers under <code>src/lib/kb/batch1Transform/</code></li>
            <li>Canonical imports in <code>data/manual_imports/</code>; raw staging in{" "}
              <code>data/manual_imports_raw/</code>
            </li>
            <li>Pipeline scripts under <code>scripts/kb/</code> and <code>scripts/pipeline/</code></li>
            <li>Embeddings and retrieval over local vector files — no cloud KB at runtime</li>
          </ul>
        </Section>

        <Section title="How to rebuild the KB locally">
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

        <Section title="Next collection priorities">
          <p>Focus areas that unlock the biggest readiness gaps:</p>
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
        </Section>
      </div>
    </main>
  );
}
