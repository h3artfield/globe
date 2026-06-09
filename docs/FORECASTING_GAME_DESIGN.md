# Forecasting Game Design

## One-paragraph pitch

**Geopolitical Forecasting Agency** is a local, evidence-based forecasting sandbox built on top of the existing country RAG globe. The player runs a forecasting shop staffed by analyst agents—not to magically predict the future, but to design, test, and improve a forecasting machine. In **Historical Replay Mode**, the player picks a country or bilateral relationship, sets an `as_of` cutoff, gathers only evidence that existed before that date, and submits a probabilistic forecast about an outcome that is already known in later data. The system scores the forecast immediately, runs a judge/critic loop, and produces postmortems. Over time the player improves source discipline, agent harnesses, and calibration—without the app ever claiming to predict the future.

## Core player fantasy

You are the director of a geopolitical forecasting agency. Your analysts are imperfect; your data is incomplete; your models leak if you are careless. Your job is not prophecy—it is **process**. You commission forecasts, enforce evidence cutoffs, compare predictions to resolved outcomes, and iterate on the machine: which sources to trust, which agents to deploy, how to combine signals, and where your reasoning failed. Winning feels like building a tighter, more honest forecasting operation—not being right every time.

## Main gameplay loop

Inspired by AlphaProof-style systems: many imperfect attempts, critique, ranking, and improvement.

```
Choose target + as_of cutoff
        ↓
Brief analyst agents (roles, constraints, evidence budget)
        ↓
Retrieve cutoff-safe evidence (structured metrics, dated events)
        ↓
Draft probabilistic forecast + rationale + cited evidence
        ↓
Submit → leakage audit runs automatically
        ↓
Reveal hidden outcome (replay) or wait (live / short-cycle)
        ↓
Score (Brier first) + judge review + postmortem
        ↓
Update scorecards: accuracy, calibration, source discipline, agent ELO
        ↓
Unlock upgrades: new templates, agents, datasets, audit tooling
        ↓
Repeat with harder targets or stricter evidence rules
```

The loop rewards **discipline** (no future leakage), **calibration** (probabilities that match base rates), and **learning** (postmortems that change the next forecast).

## Modes

### 1. Historical Replay Mode (first mode — MVP focus)

- Player chooses a **target country** or **relationship pair**.
- Player sets **`as_of_year`** and optionally **`as_of_date`**.
- All evidence retrieval is constrained to data available before the cutoff.
- Player forecasts an outcome that is **already known** in later historical data but hidden until submission.
- System reveals the outcome, scores the forecast, and generates a postmortem.
- Provides **immediate feedback** without waiting for real-world resolution.

Example: *“As of 2020, will China–USA bilateral trade (imports + exports, USD) be higher in 2024 than in 2020?”*

### 2. Live Mode (later — do not overbuild first)

- Uses **current** structured data and (eventually) curated news.
- Forecasts real future events with open resolution dates.
- Unresolved forecasts stay open until outcome data arrives.
- Same scoring and postmortem machinery as replay, but resolution is asynchronous.
- Explicit UI copy: probabilistic sandbox, not a prediction engine.

### 3. Short-Cycle Operational Mode (later)

- Forecasts events that resolve in **hours, days, or weeks**.
- Later powered by live news (GDELT, official RSS, manual event updates) after a news-organizer pipeline exists.
- Not in MVP scope.

## Agent roles

Agents are **roles in the forecasting harness**, not omniscient oracles. Each produces artifacts the player can accept, edit, or reject.

| Role | Responsibility |
|------|----------------|
| **Data Analyst** | Pulls cutoff-safe structured metrics; summarizes trends and gaps. |
| **Conflict Analyst** | Interprets UCDP/COW/world-model security events before cutoff. |
| **Diplomat** | Frames bilateral relationship context (trade, alliances, voting alignment when available). |
| **Historian** | Places the forecast in longer-run patterns using dated events only. |
| **Red Team** | Attacks assumptions, finds alternative scenarios, flags weak evidence. |
| **Judge** | Scores forecast quality, leakage compliance, and rationale strength. |
| **Engineer** | Proposes harness improvements: better filters, templates, source wiring. |

MVP may stub agents as **player-authored templates** with optional LLM assist later; the design assumes multi-agent output either way.

## Forecast lifecycle

1. **Template selection** — Pick a replay template (or custom question) with defined resolution rules.
2. **Cutoff binding** — `as_of_date` / `as_of_year` locked at creation; stored on the forecast record.
3. **Evidence phase** — Player/agents gather cutoff-safe evidence; each item carries provenance and observation date.
4. **Leakage audit** — Automatic check before submission (see technical plan).
5. **Submission** — Player locks probability (0–1), binary or multi-outcome as defined by template, plus rationale and evidence list.
6. **Resolution** — Replay: immediate lookup against hidden holdout data. Live: pending until outcome date + data ingest.
7. **Scoring** — Brier score (and derived metrics) computed from probability vs. outcome.
8. **Judge review** — Structured critique: evidence use, overconfidence, missed signals, leakage notes.
9. **Postmortem** — Lesson artifacts linked to forecast, agents, and sources for future retrieval.
10. **Archive** — Forecast, score, and postmortem feed agency scorecards and progression.

States: `draft` → `evidence_gathering` → `submitted` → `resolved` | `void` (leakage failure or invalid template).

## Scoring

### Primary: Brier score

For binary outcome \(Y \in \{0,1\}\) and forecast probability \(p\):

\[
\text{Brier} = (p - Y)^2
\]

Lower is better. Store raw Brier, outcome, and \(p\) on every resolved forecast.

### Later (not MVP)

- **Calibration curves** — Bin forecasts by predicted probability; compare to empirical resolution rates.
- **Agent ELO** — Pairwise or tournament ranking of agent configurations on resolved forecast sets.
- **Evidence quality score** — Coverage, source tier, date discipline, diversity.
- **Source discipline score** — Penalties for rejected future evidence, missing provenance, or disallowed source types.
- **Leakage penalty** — Failed audit voids score or applies a heavy penalty per product policy.

## Progression and upgrades

Progression reflects **agency capability**, not “being psychic.”

- **Replay templates unlocked** — Start with trade and democracy metrics; unlock conflict and education templates as datasets are validated.
- **Stricter audit tiers** — Optional “hard mode”: no prose RAG, structured-only evidence.
- **Agent slots** — Add Red Team or second Data Analyst to the harness.
- **Source packs** — Wire new manual imports (treaties, sanctions, UN voting) when collected.
- **Scorecard badges** — Calibration improvement, zero-leak streaks, best postmortem.
- **Globe overlays** — Visualize forecast history, accuracy by region, open vs. resolved forecasts on the globe.

No pay-to-win randomness; upgrades expand **evidence access and tooling**, not hidden knowledge.

## How this uses the globe

The existing Cesium globe remains the **spatial shell**:

- Select forecast **target** by clicking countries or relationship arcs (MVP countries and relationship pairs from `MVP_COUNTRIES` / `MVP_RELATIONSHIP_PAIRS`).
- **Cutoff timeline** control sets `as_of_year` in the UI (date picker when event-level precision matters).
- **Evidence panel** shows cutoff-safe metrics and events for selected targets (structured first).
- **Forecast panel** replaces or sits alongside the current Ask flow for replay sessions.
- **Resolution reveal** animates on the globe when applicable (e.g., trade volume comparison CHN–USA).
- **Scorecard layer** (later) colors countries by recent agency calibration or open forecast count.

The globe does not “know the future”; it displays **player forecasts and resolved historical outcomes** after submission.

## What the game should not claim

- The app **does not predict the future**.
- It is a **probabilistic forecasting sandbox** and **forecast replay** trainer.
- LLM-generated prose from RAG modules is **not ground truth**; structured datasets with observation years/dates are the replay authority.
- Missing data, collection gaps (ACLED, treaties, sanctions, UN voting), and MVP country scope are **explicit limitations**.
- Scores measure **forecast quality against known or eventual outcomes**, not geopolitical truth or policy advice.

## MVP scope

**In scope for first playable replay slice:**

- Historical Replay Mode only.
- Hand-authored **replay templates** (JSON under `data/forecasting/templates/`) for a small set of questions:
  - Bilateral trade level comparison (UN Comtrade) — e.g., CHN–USA 2020 → 2024.
  - Country metric threshold (V-Dem) — e.g., democracy index above/below value at as_of vs. later year.
  - Conflict presence (UCDP) — e.g., active conflict flag at as_of vs. later year (where data supports).
- Targets limited to **MVP countries and relationship pairs** already in the pipeline.
- Cutoff-safe retrieval from **`data/processed/`** metrics and **`data/world_model/events/`** with year/date filters.
- Leakage audit on every submission.
- Brier scoring and simple resolution reveal UI.
- File-based persistence under `data/forecasting/` (no external database).
- Single-player, local-only.

**Out of scope for MVP:**

- Live Mode and Short-Cycle Operational Mode.
- GDELT and news-organizer agent.
- Full multi-agent LLM tournament loop (stub agent roles as UI labels only).
- ELO and calibration dashboards (design hooks only).
- Cloud Agent or remote execution.
- Gameplay implementation in this phase — **planning docs only** (Phase 0).
