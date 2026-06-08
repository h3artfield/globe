# Batch 1 manual import templates

These files are **templates only**. They live in `_templates/` and are **not** ingested by adapters.

Copy your real export into the matching folder below, using the suggested production filename. The ingest adapter accepts any `.csv`, `.json`, or `.jsonl` file in that folder (not only the suggested name).

Remove any `EXAMPLE_ONLY_NOT_REAL_DATA` rows before ingesting.

## Copy map

| Template | Copy real file to folder | Suggested production filename |
|----------|--------------------------|-------------------------------|
| `vdem_country_year.template.csv` | `data/manual_imports/vdem/` | `vdem_country_year.csv` |
| `un_comtrade_bilateral.template.csv` | `data/manual_imports/un_comtrade/` | `un_comtrade_bilateral.csv` |
| `unodc_crime.template.csv` | `data/manual_imports/unodc/` | `unodc_crime.csv` |
| `unesco_uis_education.template.csv` | `data/manual_imports/unesco_uis/` | `unesco_uis_education.csv` |
| `wipo_patents.template.csv` | `data/manual_imports/wipo/` | `wipo_patents.csv` |
| `wvs_country_crosstabs.template.csv` | `data/manual_imports/world_values_survey/` | `wvs_country_crosstabs.csv` |
| `oecd_pisa_scores.template.csv` | `data/manual_imports/oecd_pisa/` | `oecd_pisa_scores.csv` |
| `unctad_trade_maritime.template.csv` | `data/manual_imports/unctad/` | `unctad_trade_maritime.csv` |

## Required columns (all metric datasets)

At minimum each row must include:

- **Country**: `country_code` (or `country_iso3`, `iso3`, `refArea`, `country`)
- **Metric**: `metric_id` (or `indicator`, `indicator_id`)
- **Value**: `value` (or `obs_value`, `metric_value`)

Recommended: `year`, `unit`, `source_url`, `source_name`, `raw_record_id`, `calculation`, `notes`

World Values Survey may also include: `sample_size`, `question_wording`, `response_mapping`, `demographic_cut`, `demographic_group`

## Allowed country codes

MVP countries: `USA`, `CHN`, `EGY`, `ETH`, `RUS`, `UKR`, `IND`, `PAK`, `ISR`, `IRN`, `SAU`, `TUR`

UN Comtrade may also include `WLD` for world-total rows used in share calculations.

## Valid metric IDs

See `src/lib/sources/sourceMetricDefinitions.ts` for the authoritative list per `source_id`.

## Preflight check

```bash
npm run kb:validate-imports
npm run kb:validate-imports -- --strict
npm run kb:validate-imports -- --source vdem --source un_comtrade
```

Default mode exits 0 when at least one dataset passes. Strict mode requires all selected datasets to pass.

## Ingest after files pass validation

```bash
npm run sources:ingest:mvp
npm run pipeline:generate
npm run pipeline:validate
npm run embeddings:build:mvp
npm run kb:matrix
npm run kb:queue
npm run kb:status
```

Per-source ingest is also available, e.g. `npm run source:ingest -- vdem`.

## Event import templates (ACLED, UCDP, Correlates of War)

| Template | Copy real file to folder | Suggested production filename |
|----------|--------------------------|-------------------------------|
| `acled_events.template.csv` | `data/manual_imports/acled/` | `acled_events.csv` |
| `ucdp_conflict.template.csv` | `data/manual_imports/ucdp/` | `ucdp_conflict.csv` |
| `cow_alliances_wars.template.csv` | `data/manual_imports/correlates_of_war/` | `cow_alliances_wars.csv` |

### Required event columns

Each row must include:

- `source_id`, `source_name`, `source_url`
- `event_date` (must parse as a date)
- `country_codes` (one or more MVP ISO3 codes, pipe/comma/semicolon separated)
- `actors`, `event_type`, `confidence`, `notes`

`confidence` may be numeric (0–1 or 0–100) or `high|medium|low|unknown`.

Bilateral rows with two MVP countries (e.g. `RUS|UKR`) feed relationship event timelines after ingest.

### Event preflight

```bash
npm run kb:validate-events
npm run kb:validate-events -- --strict
npm run kb:validate-events -- --source acled --source ucdp
```

### Event ingest

```bash
npm run source:ingest -- acled
npm run source:ingest -- ucdp
npm run source:ingest -- correlates_of_war
npm run world-model:build
```

Normalized events are written to `data/processed/events/{source}/events.v1.json` and merged into world-model event timelines (no hand-authored RAG modules overwritten).
