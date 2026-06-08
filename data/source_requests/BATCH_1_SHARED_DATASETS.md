# Batch 1 Shared Datasets — Source Collection Manifest

This document is the human-readable companion to `batch_1_shared_datasets_manifest.v1.json`.

**Purpose:** guide manual acquisition of the 11 shared Batch 1 datasets for the MVP scope.  
**This is a collection manifest only** — no raw data belongs in the repo until you explicitly approve download.

Machine-readable manifest: `data/source_requests/batch_1_shared_datasets_manifest.v1.json`

---

## Raw → canonical pipeline

Official exports should **not** be hand-edited into template shape. Use the transform layer:

| Step | Location / command |
|------|-------------------|
| 1. Raw staging | Drop official export in `data/manual_imports_raw/{source}/` |
| 2. Transform | `npm run kb:transform-batch1 -- --source {source}` |
| 3. Receipts | `data/source_receipts/{source}.source_receipts.v1.json` (auto-written by transform) |
| 4. Canonical output | `data/manual_imports/{source}/{canonical_file}.csv` |
| 5. Receipt check | `npm run kb:receipts` |
| 6. Validate | `kb:validate-imports` (metrics) or `kb:validate-events` (events) — **canonical only** |
| 7. Ingest | `npm run source:ingest -- {source}` |

**Rule:** Raw official exports go to `data/manual_imports_raw/{source}/`. Transform creates canonical files and receipts. Before ingest, run `npm run kb:receipts`, then validate the canonical file.

**Implemented transformers:** `vdem`, `acled`, `ucdp`, `correlates_of_war`

**Placeholder transformers** (fail with clear message): `un_comtrade`, `unodc`, `unesco_uis`, `wipo`, `world_values_survey`, `oecd_pisa`, `unctad` — use template format manually until mapping is implemented.

Partial transform:

```bash
npm run kb:transform-batch1 -- --source vdem --source un_comtrade
```

### V-Dem end-to-end test sequence

```bash
# 1. Drop raw V-Dem Country-Year CSV into data/manual_imports_raw/vdem/
npm run kb:transform-batch1 -- --source vdem
npm run kb:receipts
npm run kb:validate-imports -- --source vdem
npm run source:ingest -- vdem
npm run pipeline:generate
npm run pipeline:validate
npm run embeddings:build:mvp
npm run kb:matrix
npm run kb:queue
npm run kb:status
```

---

## MVP scope

**Countries (12):** USA, CHN, EGY, ETH, RUS, UKR, IND, PAK, ISR, IRN, SAU, TUR

**Relationships (8):** CHN_USA, EGY_ETH, RUS_UKR, IND_PAK, IRN_ISR, IRN_SAU, SAU_TUR, RUS_TUR

---

## Recommended manual download order

Collect in this order to maximize early country coverage and unlock relationship modules as soon as possible:

| Order | Queue ID | Adapter | Account? | Why this order |
|------:|----------|---------|----------|----------------|
| 1 | `shared-vdem_country_year` | metric_ready | No | Highest priority; open; governance/media metrics for all 12 countries |
| 2 | `shared-acled_events` | event_ready | Yes | Unlocks national + bilateral event timelines (all 8 pairs) |
| 3 | `shared-ucdp_conflict` | event_ready | No | Conflict events; feeds war/crisis relationship modules |
| 4 | `shared-correlates_of_war` | event_ready | No | Alliance and interstate war history for relationship modules |
| 5 | `shared-un_comtrade_bilateral` | metric_ready | Yes | Bilateral trade for countries and all 8 relationship pairs |
| 6 | `shared-unodc_crime` | metric_ready | No | Crime/safety country coverage |
| 7 | `shared-unesco_uis_education` | metric_ready | Unknown | Education indicators for all MVP ISO3 |
| 8 | `shared-wipo_patents` | metric_ready | No | Technology/patent country metrics |
| 9 | `shared-unctad_trade` | metric_ready | No | Trade/maritime; some bilateral rows for pairs |
| 10 | `shared-world_values_survey` | metric_ready | Yes | Survey crosstabs; wave coverage varies by country |
| 11 | `shared-oecd_pisa` | metric_ready | No | Subset of MVP countries participate; lowest Batch 1 priority |

After each dataset: raw staging → transform → validate → ingest → run post-ingest commands listed in the manifest.

---

## Dataset reference

### 1. V-Dem Country-Year (`shared-vdem_country_year`)

| Field | Value |
|-------|-------|
| Homepage | https://www.v-dem.net/ |
| Download | https://www.v-dem.net/data/the-v-dem-dataset/ |
| Account | No |
| Folder / file | `data/manual_imports/vdem/vdem_country_year.csv` |
| Template | `data/manual_imports/_templates/vdem_country_year.template.csv` |
| Validate | `npm run kb:validate-imports -- --source vdem` |
| Ingest | `npm run source:ingest -- vdem` |

**Country filter:** all 12 MVP ISO3 codes.  
**Relationship filter:** none (country-only).

---

### 2. UN Comtrade Bilateral (`shared-un_comtrade_bilateral`)

| Field | Value |
|-------|-------|
| Homepage | https://uncomtrade.org/ |
| Download | https://comtradeplus.un.org/ |
| Account | Yes (registration typical) |
| Folder / file | `data/manual_imports/un_comtrade/un_comtrade_bilateral.csv` |
| Template | `data/manual_imports/_templates/un_comtrade_bilateral.template.csv` |
| Validate | `npm run kb:validate-imports -- --source un_comtrade` |
| Ingest | `npm run source:ingest -- un_comtrade` |

**Country filter:** reporter or partner in MVP ISO3 set; `WLD` allowed only for world-total share rows.  
**Relationship filter:** bilateral rows for all 8 MVP pairs (either direction).

---

### 3. ACLED Events (`shared-acled_events`)

| Field | Value |
|-------|-------|
| Homepage | https://acleddata.com/ |
| Download | https://acleddata.com/data-export-tool/ |
| Account | Yes (myACLED) |
| Folder / file | `data/manual_imports/acled/acled_events.csv` |
| Template | `data/manual_imports/_templates/acled_events.template.csv` |
| Validate | `npm run kb:validate-events -- --source acled` |
| Ingest | `npm run source:ingest -- acled` |

**Country filter:** events in any MVP country; prefer 2006–present.  
**Relationship filter:** events with both countries in a pair (`country_codes` or actors). Feeds all 8 relationship event timelines.

**Post-ingest:** includes `npm run world-model:build`.

---

### 4. UCDP Conflict (`shared-ucdp_conflict`)

| Field | Value |
|-------|-------|
| Homepage | https://ucdp.uu.se/ |
| Download | https://ucdp.uu.se/downloads/ |
| Account | No |
| Folder / file | `data/manual_imports/ucdp/ucdp_conflict.csv` |
| Template | `data/manual_imports/_templates/ucdp_conflict.template.csv` |
| Validate | `npm run kb:validate-events -- --source ucdp` |
| Ingest | `npm run source:ingest -- ucdp` |

**Country filter:** conflicts with MVP country as location/party.  
**Relationship filter:** dyadic conflicts between MVP pair members.

---

### 5. UNESCO UIS Education (`shared-unesco_uis_education`)

| Field | Value |
|-------|-------|
| Homepage | https://uis.unesco.org/ |
| Download | http://data.uis.unesco.org/ |
| Account | Unknown — confirm on portal |
| Folder / file | `data/manual_imports/unesco_uis/unesco_uis_education.csv` |
| Template | `data/manual_imports/_templates/unesco_uis_education.template.csv` |
| Validate | `npm run kb:validate-imports -- --source unesco_uis` |
| Ingest | `npm run source:ingest -- unesco_uis` |

**Country filter:** all 12 MVP ISO3.  
**Relationship filter:** none.

---

### 6. WIPO Patents (`shared-wipo_patents`)

| Field | Value |
|-------|-------|
| Homepage | https://www.wipo.int/ |
| Download | https://www.wipo.int/ipstats/en/ |
| Account | No |
| Folder / file | `data/manual_imports/wipo/wipo_patents.csv` |
| Template | `data/manual_imports/_templates/wipo_patents.template.csv` |
| Validate | `npm run kb:validate-imports -- --source wipo` |
| Ingest | `npm run source:ingest -- wipo` |

**Country filter:** all 12 MVP ISO3.  
**Relationship filter:** none.

---

### 7. UNODC Crime (`shared-unodc_crime`)

| Field | Value |
|-------|-------|
| Homepage | https://www.unodc.org/ |
| Download | https://www.unodc.org/unodc/en/data-and-analysis/statistics.html |
| Account | No |
| Folder / file | `data/manual_imports/unodc/unodc_crime.csv` |
| Template | `data/manual_imports/_templates/unodc_crime.template.csv` |
| Validate | `npm run kb:validate-imports -- --source unodc` |
| Ingest | `npm run source:ingest -- unodc` |

**Country filter:** all 12 MVP ISO3 (sparse years possible).  
**Relationship filter:** none.

---

### 8. World Values Survey (`shared-world_values_survey`)

| Field | Value |
|-------|-------|
| Homepage | https://www.worldvaluessurvey.org/ |
| Download | `unknown_needs_manual_lookup` |
| Account | Yes |
| Folder / file | `data/manual_imports/world_values_survey/wvs_country_crosstabs.csv` |
| Template | `data/manual_imports/_templates/wvs_country_crosstabs.template.csv` |
| Validate | `npm run kb:validate-imports -- --source world_values_survey` |
| Ingest | `npm run source:ingest -- world_values_survey` |

**Country filter:** MVP countries with available waves (coverage uneven).  
**Relationship filter:** none.

---

### 9. Correlates of War (`shared-correlates_of_war`)

| Field | Value |
|-------|-------|
| Homepage | https://correlatesofwar.org/ |
| Download | https://correlatesofwar.org/data-sets/ |
| Account | No |
| Folder / file | `data/manual_imports/correlates_of_war/cow_alliances_wars.csv` |
| Template | `data/manual_imports/_templates/cow_alliances_wars.template.csv` |
| Validate | `npm run kb:validate-events -- --source correlates_of_war` |
| Ingest | `npm run source:ingest -- correlates_of_war` |

**Country filter:** alliance/war records involving any MVP state.  
**Relationship filter:** dyadic alliance and war rows for all 8 MVP pairs.

---

### 10. OECD PISA (`shared-oecd_pisa`)

| Field | Value |
|-------|-------|
| Homepage | https://www.oecd.org/pisa/ |
| Download | https://www.oecd.org/pisa/data/ |
| Account | No |
| Folder / file | `data/manual_imports/oecd_pisa/oecd_pisa_scores.csv` |
| Template | `data/manual_imports/_templates/oecd_pisa_scores.template.csv` |
| Validate | `npm run kb:validate-imports -- --source oecd_pisa` |
| Ingest | `npm run source:ingest -- oecd_pisa` |

**Country filter:** participating MVP countries only (do not fabricate non-participants).  
**Relationship filter:** none.

---

### 11. UNCTAD Trade & Maritime (`shared-unctad_trade`)

| Field | Value |
|-------|-------|
| Homepage | https://unctad.org/ |
| Download | https://unctadstat.unctad.org/ |
| Account | No |
| Folder / file | `data/manual_imports/unctad/unctad_trade_maritime.csv` |
| Template | `data/manual_imports/_templates/unctad_trade_maritime.template.csv` |
| Validate | `npm run kb:validate-imports -- --source unctad` |
| Ingest | `npm run source:ingest -- unctad` |

**Country filter:** all 12 MVP ISO3.  
**Relationship filter:** bilateral/partner rows for 8 MVP pairs where available.

---

## Partial-batch workflow

Validators support partial batches:

```bash
# Metrics — pass if at least one selected source validates
npm run kb:validate-imports -- --source vdem
npm run source:ingest -- vdem

# Events
npm run kb:validate-events -- --source acled --source ucdp
npm run source:ingest -- acled
npm run world-model:build
```

Strict mode (all selected must pass):

```bash
npm run kb:validate-imports -- --strict
npm run kb:validate-events -- --strict
```

---

## Relationship unlock summary

These shared datasets feed **relationship** coverage:

| Source | Relationship modules helped |
|--------|----------------------------|
| ACLED | `relationship_event_timeline`, `crisis_history`, `military_relationship` |
| UCDP | `war_history`, `crisis_history`, `adversary_status` |
| COW | `alliance_status`, `war_history`, `diplomatic_history` |
| UN Comtrade | `trade_relationship` |
| UNCTAD | `trade_relationship` |

Until event and bilateral metric files are collected, relationship readiness stays at 0.00 in `kb:status`.

---

## Do not

- Download or commit raw exports without explicit approval
- Fabricate rows for countries/sources with no real data
- Copy template `EXAMPLE_ONLY_NOT_REAL_DATA` rows into production files
