# Forecasting Game Technical Plan

Local file-based architecture extension for the geopolitical forecasting sandbox. No external database. No Cloud Agent. Builds on existing `data/processed/`, `data/world_model/`, `data/manual_imports/`, and Next.js API routes.

---

## Proposed data folders under `data/forecasting/`

```
data/forecasting/
├── templates/                    # Replay question definitions (hand-authored, versioned)
│   └── replay/
│       ├── trade_bilateral_level.v1.json
│       ├── vdem_index_threshold.v1.json
│       └── ucdp_conflict_active.v1.json
├── sessions/                     # Player replay/live sessions
│   └── {session_id}/
│       ├── session.v1.json
│       └── forecasts/
│           └── {forecast_id}.v1.json
├── resolutions/                  # Holdout outcome lookups (generated, not shown pre-submit)
│   └── replay/
│       └── {template_id}/
│           └── {target_id}/
│               └── {resolution_key}.v1.json
├── evidence_snapshots/           # Cutoff-safe evidence bundles at submission time
│   └── {forecast_id}.v1.json
├── audits/                       # Leakage audit records
│   └── {forecast_id}.v1.json
├── scorecards/                   # Agency and per-agent aggregates
│   ├── agency.v1.json
│   └── agents/
│       └── {agent_id}.v1.json
├── postmortems/
│   └── {forecast_id}.v1.json
└── judges/
    └── {forecast_id}.v1.json
```

Scripts (future phases, not Phase 0):

```
scripts/forecasting/
├── build_replay_resolutions.ts   # Precompute resolution payloads from processed data
├── validate_templates.ts
├── run_leakage_audit.ts
└── score_forecast.ts
```

---

## Proposed TypeScript types

New file: `src/types/forecasting.ts` (Phase 1+; documented here for planning).

```typescript
export type ForecastMode = "historical_replay" | "live" | "short_cycle";

export type ForecastTargetType = "country" | "relationship";

export type ForecastTarget = {
  target_type: ForecastTargetType;
  target_id: string; // e.g. "CHN" or "CHN_USA"
};

export type AsOfCutoff = {
  as_of_year: number;
  as_of_date: string; // ISO date; end-of-day inclusive for events
};

export type LeakageStatus = "passed" | "failed";

export type LeakageAudit = {
  forecast_id: string;
  as_of_cutoff: AsOfCutoff;
  audited_at: string;
  newest_evidence_date_used: string | null;
  evidence_count: number;
  rejected_future_evidence_count: number;
  leakage_status: LeakageStatus;
  rejected_items: LeakageRejectedItem[];
  notes: string;
};

export type LeakageRejectedItem = {
  evidence_id: string;
  source_type: EvidenceSourceType;
  observation_date: string | null;
  observation_year: number | null;
  reason: "future_date" | "future_year" | "disallowed_source" | "missing_provenance";
};

export type EvidenceSourceType =
  | "processed_metric"
  | "world_model_event"
  | "canonical_metric_row"
  | "canonical_event_row"
  | "replay_template_hint"; // static template text only

export type ForecastEvidenceItem = {
  evidence_id: string;
  source_type: EvidenceSourceType;
  source_id: string; // e.g. "un_comtrade", "vdem", "ucdp"
  observation_year: number | null;
  observation_date: string | null; // ISO date
  metric_id?: string;
  event_id?: string;
  label: string;
  value_summary: string;
  file_path: string;
  raw_record_id?: string;
};

export type ForecastStatus =
  | "draft"
  | "evidence_gathering"
  | "submitted"
  | "resolved"
  | "void";

export type ForecastRecord = {
  forecast_id: string;
  session_id: string;
  mode: ForecastMode;
  template_id: string;
  target: ForecastTarget;
  as_of_cutoff: AsOfCutoff;
  question_text: string;
  probability: number; // 0..1
  rationale: string;
  evidence: ForecastEvidenceItem[];
  status: ForecastStatus;
  created_at: string;
  submitted_at: string | null;
  leakage_audit_id: string | null;
  resolution_id: string | null;
  scorecard_id: string | null;
};

export type ResolutionOutcome = {
  outcome_binary: 0 | 1;
  outcome_label: string;
  outcome_value?: number | string;
  baseline_value?: number | string;
  comparison_value?: number | string;
  resolution_year?: number;
  resolution_date?: string;
};

export type ResolutionRecord = {
  resolution_id: string;
  template_id: string;
  target: ForecastTarget;
  as_of_cutoff: AsOfCutoff;
  holdout_rule: string; // e.g. "compare_metric_years:2020,2024"
  outcome: ResolutionOutcome;
  resolver_source: string; // e.g. "data/processed/countries/CHN/metrics.v1.json"
  resolved_at: string;
  hidden_until_submit: true;
};

export type BrierScore = {
  probability: number;
  outcome: 0 | 1;
  brier: number;
};

export type JudgeVerdict = {
  forecast_id: string;
  judge_agent_id: string;
  judged_at: string;
  leakage_status: LeakageStatus;
  rationale_quality: "weak" | "adequate" | "strong";
  evidence_quality: "weak" | "adequate" | "strong";
  overconfidence_flag: boolean;
  missed_signals: string[];
  strengths: string[];
  improvements: string[];
  summary: string;
};

export type ForecastScorecard = {
  scorecard_id: string;
  forecast_id: string;
  brier: BrierScore;
  leakage_status: LeakageStatus;
  evidence_count: number;
  source_discipline_score: number | null; // Phase 4+
  agent_ids: string[];
  computed_at: string;
};

export type AgencyScorecard = {
  version: "1.0";
  updated_at: string;
  total_forecasts: number;
  resolved_forecasts: number;
  mean_brier: number | null;
  leakage_failures: number;
  calibration_bins: CalibrationBin[]; // Phase 6
  agent_elo: Record<string, number>; // Phase 6
};

export type CalibrationBin = {
  bin_start: number;
  bin_end: number;
  count: number;
  empirical_rate: number;
};

export type ReplayTemplate = {
  template_id: string;
  version: "1.0";
  mode: "historical_replay";
  title: string;
  description: string;
  target_type: ForecastTargetType;
  allowed_targets: string[];
  default_as_of_year: number;
  min_resolution_year: number;
  question_template: string; // placeholders: {target}, {as_of_year}, {resolution_year}
  resolution_spec: ResolutionSpec;
  allowed_evidence_sources: EvidenceSourceType[];
  allowed_source_ids: string[];
};

export type ResolutionSpec =
  | {
      kind: "metric_compare_years";
      metric_id: string;
      source_id: string;
      baseline_year_from_as_of: boolean;
      resolution_year: number;
      comparator: "gt" | "gte" | "lt" | "lte";
      relationship_id?: string; // for bilateral metrics in country file notes
    }
  | {
      kind: "metric_threshold";
      metric_id: string;
      source_id: string;
      year: number;
      threshold: number;
      comparator: "gt" | "gte" | "lt" | "lte";
    }
  | {
      kind: "event_exists";
      source_id: string;
      event_type: string;
      window_start: string;
      window_end: string;
    };
```

Reuse existing types where possible:

- `MetricValue` from `src/types/pipeline.ts` — evidence from `data/processed/countries/*/metrics.v1.json`
- `WorldEvent` / `RelationshipEvent` from `src/types/worldModel.ts` — evidence from `data/world_model/events/`
- `CanonicalMetricRow` / `CanonicalEventRow` from `src/lib/kb/batch1Transform/types.ts` — optional direct CSV reads for audit trails

---

## Proposed routes and pages

### Pages (App Router)

| Route | Purpose | Phase |
|-------|---------|-------|
| `/forecast` | Forecast hub: mode picker (replay enabled first) | 1 |
| `/forecast/replay` | Historical replay: target, cutoff, template, evidence, submit | 1–3 |
| `/forecast/replay/[forecastId]` | Submitted forecast: audit, resolution reveal, score | 3 |
| `/forecast/scorecard` | Agency scorecard (Brier, leakage stats) | 4 |
| `/forecast/live` | Placeholder; disabled in MVP | 5+ |

Globe integration: extend `src/app/page.tsx` or add `/forecast/replay` with shared `Globe` component and forecast-specific panels (Phase 1+).

### API routes

| Method | Route | Purpose | Phase |
|--------|-------|---------|-------|
| GET | `/api/forecast/templates` | List replay templates | 1 |
| GET | `/api/forecast/templates/[templateId]` | Template detail | 1 |
| POST | `/api/forecast/sessions` | Create replay session | 2 |
| GET | `/api/forecast/evidence` | Cutoff-safe evidence query (`target`, `as_of_year`, `as_of_date`, `source_ids`) | 2 |
| POST | `/api/forecast/forecasts` | Create/update draft forecast | 3 |
| POST | `/api/forecast/forecasts/[forecastId]/submit` | Run leakage audit + lock submission | 3 |
| GET | `/api/forecast/forecasts/[forecastId]/resolution` | Return outcome (403 until submitted) | 3 |
| GET | `/api/forecast/forecasts/[forecastId]/score` | Brier + scorecard | 3 |
| GET | `/api/forecast/forecasts/[forecastId]/audit` | Leakage audit record | 3 |
| GET | `/api/forecast/scorecard` | Agency aggregates | 4 |
| GET | `/api/forecast/forecasts/[forecastId]/postmortem` | Postmortem artifact | 4 |
| GET | `/api/forecast/forecasts/[forecastId]/judge` | Judge verdict | 4 |

Query params for evidence endpoint:

```
GET /api/forecast/evidence?
  target_type=relationship&
  target_id=CHN_USA&
  as_of_year=2020&
  as_of_date=2020-12-31&
  source_ids=un_comtrade,vdem,ucdp
```

---

## `as_of` cutoff filtering design

### Principles

1. Every replay forecast **binds** `as_of_cutoff` at creation; it cannot change after evidence is attached.
2. **Structured metrics**: include row iff `metric.year !== null && metric.year <= as_of_year`.
3. **World model events**: include event iff `event.event_date <= as_of_date` (parse ISO, compare at date granularity). Also require `event.year <= as_of_year` as a secondary check.
4. **Canonical CSV rows** (optional direct reads): `year <= as_of_year` for metrics; `event_date <= as_of_date` for events.
5. **Disallowed by default in replay**: RAG prose modules, embeddings/chunks, `news_memory`, `wikipedia_baseline`, `top_national_events_20_years` summaries, dossier drafts, and any artifact without a reliable observation date/year.

### Implementation sketch

New module: `src/lib/forecasting/cutoffFilter.ts`

```typescript
export function filterMetricsByCutoff(
  metrics: MetricValue[],
  asOfYear: number,
): MetricValue[];

export function filterEventsByCutoff<T extends { event_date: string; year: number }>(
  events: T[],
  asOfDate: string,
  asOfYear: number,
): T[];

export function isSourceAllowedInReplay(sourceId: string): boolean;

export function assertEvidenceCutoffSafe(
  item: ForecastEvidenceItem,
  cutoff: AsOfCutoff,
): { ok: true } | { ok: false; reason: LeakageRejectedItem["reason"] };
```

Central allowlist for replay (initial):

| source_id | Filter field | Replay-safe |
|-----------|--------------|-------------|
| vdem | year | yes |
| un_comtrade | year | yes |
| unodc | year | yes |
| unesco_uis | year | yes |
| wipo | year | yes |
| unctad | year | yes |
| world_values_survey | year | yes (verify wave year mapping) |
| oecd_pisa | year | yes (PISA cycle year) |
| ucdp | event_date, year | yes |
| correlates_of_war | event_date, year | yes |
| acled | event_date | yes when data exists |
| world_model events | event_date, year | yes |
| rag / chunks / embeddings | n/a | **no** |
| news_memory, wikipedia_* | n/a | **no** |

### Bilateral trade example

Resolution uses **hidden** Comtrade rows for `resolution_year` (e.g., 2024) loaded only in `resolutions/` builder, never passed to evidence API.

Evidence API returns Comtrade metrics for reporter/partner with `year <= as_of_year` from `data/processed/countries/{reporter}/metrics.v1.json` filtered by `relationship_id` in metric notes.

---

## Leakage audit design

Runs on **submit** (and optionally on evidence attach for early feedback).

### Algorithm

1. Load forecast `as_of_cutoff` and attached `evidence[]`.
2. For each evidence item:
   - If `source_type` is disallowed → reject (`disallowed_source`).
   - If `observation_year` is null for metric types → reject (`missing_provenance`) unless template explicitly allows.
   - If `observation_year > as_of_year` → reject (`future_year`).
   - If `observation_date > as_of_date` → reject (`future_date`).
3. Compute:
   - `newest_evidence_date_used` = max of valid observation dates/years (normalize year-only to `YYYY-12-31` for comparison).
   - `evidence_count` = count of accepted items.
   - `rejected_future_evidence_count` = count of rejected items.
4. Set `leakage_status`:
   - `passed` if zero rejections and all required provenance present.
   - `failed` if any rejection or any disallowed source used.
5. Persist to `data/forecasting/audits/{forecast_id}.v1.json`.
6. On `failed`: forecast → `void` or block resolution reveal (product choice: **block resolution and score** in MVP).

### Resolution holdout separation

- `build_replay_resolutions.ts` reads full processed metrics but writes only to `data/forecasting/resolutions/`.
- Evidence API and cutoff filter **must not** import from `resolutions/`.
- Resolution endpoint checks `forecast.status === "submitted"` and audit `leakage_status === "passed"` before returning outcome.

---

## Schema reference (JSON shapes)

### Forecast (`data/forecasting/sessions/{session_id}/forecasts/{forecast_id}.v1.json`)

```json
{
  "forecast_id": "fcst_20260609_001",
  "session_id": "sess_20260609_001",
  "mode": "historical_replay",
  "template_id": "trade_bilateral_level",
  "target": { "target_type": "relationship", "target_id": "CHN_USA" },
  "as_of_cutoff": { "as_of_year": 2020, "as_of_date": "2020-12-31" },
  "question_text": "As of 2020, will CHN-USA bilateral trade be higher in 2024 than in 2020?",
  "probability": 0.65,
  "rationale": "...",
  "evidence": [],
  "status": "draft",
  "created_at": "2026-06-09T12:00:00.000Z",
  "submitted_at": null,
  "leakage_audit_id": null,
  "resolution_id": "res_trade_CHN_USA_2020_2024",
  "scorecard_id": null
}
```

### Resolution (`data/forecasting/resolutions/replay/...`)

```json
{
  "resolution_id": "res_trade_CHN_USA_2020_2024",
  "template_id": "trade_bilateral_level",
  "target": { "target_type": "relationship", "target_id": "CHN_USA" },
  "as_of_cutoff": { "as_of_year": 2020, "as_of_date": "2020-12-31" },
  "holdout_rule": "metric_compare_years:imports_total_usd+exports_total_usd:2020:2024:gt",
  "outcome": {
    "outcome_binary": 1,
    "outcome_label": "Trade higher in 2024 than 2020",
    "baseline_value": 560000000000,
    "comparison_value": 690000000000
  },
  "resolver_source": "data/processed/countries/CHN/metrics.v1.json",
  "resolved_at": "2026-06-09T00:00:00.000Z",
  "hidden_until_submit": true
}
```

### Judge (`data/forecasting/judges/{forecast_id}.v1.json`)

```json
{
  "forecast_id": "fcst_20260609_001",
  "judge_agent_id": "judge_default",
  "judged_at": "2026-06-09T12:05:00.000Z",
  "leakage_status": "passed",
  "rationale_quality": "adequate",
  "evidence_quality": "strong",
  "overconfidence_flag": false,
  "missed_signals": ["UNCTAD maritime connectivity trend"],
  "strengths": ["Used Comtrade baseline correctly"],
  "improvements": ["Consider dual-outcome calibration"],
  "summary": "..."
}
```

### Scorecard (`data/forecasting/scorecards/` per forecast + agency aggregate)

Per-forecast scorecard embeds `BrierScore`. Agency file rolls up means and leakage failure counts.

---

## Datasets: replay-ready now vs. not safe yet

### Replay-ready immediately (with cutoff filters)

Structured data already transformed and present under `data/processed/countries/*/metrics.v1.json` and `data/processed/events/`:

| Dataset | source_id | Use in replay | Notes |
|---------|-----------|---------------|-------|
| V-Dem | vdem | Metric threshold, trend | Year on each `MetricValue` |
| UN Comtrade | un_comtrade | Bilateral trade compare | Bilateral rows in country metrics; filter by `relationship_id` in notes |
| UCDP | ucdp | Conflict active/exists | Events in `data/processed/events/ucdp/` and world model timelines |
| Correlates of War | correlates_of_war | Alliance/war events | Dated events |
| UNODC | unodc | Crime metrics | Annual metrics |
| UNESCO UIS | unesco_uis | Education metrics | Annual |
| WIPO | wipo | Patent metrics | Annual |
| UNCTAD | unctad | Trade/maritime metrics | Annual |
| World Values Survey | world_values_survey | Attitude metrics | Verify wave/year mapping per row |
| OECD PISA | oecd_pisa | Education scores | PISA cycle years |

World model: `data/world_model/events/countries/*/national_event_timeline.v1.json` and `relationships/*/relationship_event_timeline.v1.json` — safe when `event_date <= as_of_date`.

MVP geography: 12 countries, 8 relationship pairs (`src/lib/pipeline/constants.ts`).

### Not safe to use yet in replay

| Source / artifact | Reason |
|-------------------|--------|
| RAG module JSON (`data/rag/**`) | Prose summaries; `last_updated` is build time, not observation time |
| Embeddings / chunks (`chunks.jsonl`, vector store) | No per-chunk observation cutoff; retrieval would leak narrative context |
| `news_memory`, `wikipedia_baseline`, `top_national_events_20_years` | Span future or undated synthesis |
| Dossier drafts (`data/drafts/**`) | Unreviewed LLM content |
| ACLED | Transformer implemented (`acledTransform.ts`) but collection blocked; no reliable local file |
| treaties_manual | Needed; not imported |
| sanctions_manual | Needed; not imported |
| un_voting_alignment | Needed; not imported |
| GDELT | Planned; folder/README only — do not implement yet |
| Resolution holdout files | Must never enter evidence pipeline |

### WVS / PISA caveat

Wave or cycle year must be stored on each metric row before high-stakes replay templates. Validate with `kb:validate-imports` and spot-check `metrics.v1.json` during Phase 2.

---

## News plan (GDELT — later, Phase 5)

Not implemented in MVP. Planned pipeline:

```
collect (GDELT / RSS / manual)
  → news-organizer agent
      → dedupe
      → cluster
      → map to countries / relationship pairs
      → classify event type
      → score source quality
      → extract claims + dates + URLs
      → assign module / forecast eligibility
  → dated event store under data/forecasting/news/ or data/processed/events/gdelt/
```

Replay mode would only ingest news items with **`published_date <= as_of_date`** once organizer exists. Live and short-cycle modes consume fresh items after organizer quality gates.

---

## Phased implementation plan

### Phase 0: docs only (current)

- [x] `docs/FORECASTING_GAME_DESIGN.md`
- [x] `docs/FORECASTING_TECHNICAL_PLAN.md`
- No gameplay code, routes, or data folders required yet.

### Phase 1: static replay templates

- Create `data/forecasting/templates/replay/*.v1.json` (3–5 templates).
- Add `src/types/forecasting.ts`.
- Add `/forecast` and `/forecast/replay` placeholder pages listing templates.
- Add `GET /api/forecast/templates`.
- Optional: link from About or main nav.

### Phase 2: cutoff-safe structured evidence retrieval

- Implement `src/lib/forecasting/cutoffFilter.ts` and `loadCutoffSafeEvidence.ts`.
- Add `GET /api/forecast/evidence` reading from `data/processed/` and world model events only.
- Unit tests: future year/date rows excluded; bilateral Comtrade filter works.
- Script: `scripts/forecasting/build_replay_resolutions.ts` → `data/forecasting/resolutions/`.

### Phase 3: forecast creation and Brier scoring

- Session + forecast file CRUD under `data/forecasting/sessions/`.
- Submit flow + leakage audit persistence.
- Resolution reveal endpoint (post-submit, audit passed).
- Brier computation: `(p - y)^2`.
- UI: probability slider, evidence picker, submit, reveal, score display.

### Phase 4: postmortems and agent scorecards

- Judge verdict schema (template-based or LLM-assisted with strict JSON output).
- Postmortem files linked to forecasts.
- Agency scorecard aggregation script + `/forecast/scorecard`.
- Track: mean Brier, leakage failures, evidence counts, source discipline (simple heuristic).

### Phase 5: live news / GDELT organizer

- Implement news-organizer agent pipeline (see above).
- Enable Live Mode shell with open forecasts.
- Do not enable in replay until provenance dates are reliable.

### Phase 6: agent tournament / ELO loop

- Multiple agent configs produce competing forecasts on same template instance.
- Pairwise or round-robin ranking → agent ELO.
- Calibration bins on agency scorecard.
- Optional: automated Red Team + Judge passes.

---

## Integration with existing codebase

| Existing piece | Forecasting use |
|----------------|-----------------|
| `src/lib/pipeline/io.ts` (`readJsonFile`, `repoPath`) | Read/write all `data/forecasting/` artifacts |
| `src/lib/pipeline/constants.ts` | MVP targets for templates |
| `data/processed/countries/*/metrics.v1.json` | Primary replay evidence + resolution input |
| `src/lib/worldModel/loadWorldModel.ts` | Load events with cutoff filter |
| `src/lib/kb/batch1Transform/registry.ts` | Source allowlist alignment |
| Globe components | Target selection UI |
| `src/app/api/ask/route.ts` | Unchanged; replay must not call unconstrained RAG |

**Do not** route replay evidence through `buildRetrievalContext` or hybrid chunk search until chunks carry observation dates and cutoff-aware indexing exists.

---

## Open engineering concerns

1. **Metric year data quality** — Some transformed rows may have incorrect years (e.g., V-Dem historical columns); Phase 2 needs validation reports per source.
2. **Bilateral trade aggregation** — Comtrade stores bilateral rows on reporter country metrics with partner in notes; resolution builder must sum imports+exports consistently for both baseline and holdout years.
3. **No relationship-level processed folder** — Relationship-scoped evidence is derived by filtering country metrics and relationship events, not a separate `data/processed/relationships/` tree.
4. **Single-player file writes** — Concurrent writes to `agency.v1.json` need simple file locking or append-only event log if multiple tabs used.
5. **Judge/postmortem LLM** — If added, must not receive holdout resolution before player submit; judge runs after reveal only.

---

## Phase 0 exit criteria

- Design and technical plan reviewed.
- `npm run typecheck` passes (no new types required until Phase 1).
- No git push; no gameplay implementation.
