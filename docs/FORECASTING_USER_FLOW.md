# Forecast Lab User Flow

Local-first workflow for the Historical Replay Forecast Lab (Phases 1–11). All runtime artifacts live under `data/forecasting/` and are gitignored; only folder scaffolds and hand-authored templates are tracked.

**UI entry:** `/forecast` → Agents, Replay, Source Requests, Leaderboard, Tournaments.

**API base:** `/api/forecast/...`

---

## 1. Replay templates

Templates define historical questions with cutoff-safe evidence rules and resolution specs.

- **Browse:** `GET /api/forecast/templates` or `/forecast/replay`
- **Examples:** `unodc_homicide_rate_direction`, `vdem_electoral_democracy_direction`, `ucdp_active_conflict`
- Templates are versioned JSON under `data/forecasting/templates/replay/`

---

## 2. Sessions

A session is one forecast attempt: template + target + forecast year + optional agent.

1. **Create:** `POST /api/forecast/replay/sessions`
   ```json
   { "template_id": "unodc_homicide_rate_direction", "target": "USA", "year": 2010, "agent_id": "..." }
   ```
2. **Draft forecast:** `PATCH /api/forecast/replay/sessions/{session_id}` with probability (0–100), confidence, rationale, key signals, assumptions, uncertainty notes
3. **Status flow:** `draft` → `locked` → `resolved`

**UI:** `/forecast/replay/{session_id}`

---

## 3. Evidence snapshots

Cutoff-safe evidence bundles captured at forecast time. Future-dated records are excluded.

1. **Generate:** `POST /api/forecast/replay/sessions/{session_id}/evidence-snapshot`
2. **View:** `GET .../evidence-snapshot`
3. Regenerate after source fulfillment (draft) or post-lock for audit (`post_lock_regeneration: true`; does not replace the original snapshot id on locked sessions)

---

## 4. Forecast lock

Locking freezes the forecast for scoring.

1. Requires a probability on the session
2. **Lock:** `POST /api/forecast/replay/sessions/{session_id}/lock`
3. Locked sessions reject draft edits, agent runs, and apply-draft

---

## 5. Resolution, scoring, judge, postmortem

After lock:

| Step | Endpoint | Notes |
|------|----------|-------|
| Resolve | `POST .../resolve` | Looks up holdout outcome from local resolution data |
| Score | `POST .../score` | Brier score + direction accuracy; idempotent |
| Judge | `POST .../judge` | Leakage/source/resolution audit warnings |
| Postmortem | `POST .../postmortem` | Missed signals + next-time rules; idempotent |

Read scorecard/audit/postmortem via `GET .../scorecard`, `GET .../audit`, `GET .../postmortem`.

---

## 6. Agent runs

Deterministic local strategies (no external APIs):

- `cautious_source_hound` — requests sources when evidence is thin
- `balanced_baseline` — drafts on medium evidence
- `aggressive_pattern_matcher` — drafts on weaker evidence with higher uncertainty

1. **Run:** `POST /api/forecast/replay/sessions/{session_id}/agent-runs`
   ```json
   { "strategy_id": "balanced_baseline", "agent_id": "..." }
   ```
2. **Apply draft:** `POST .../agent-runs/{agent_run_id}/apply` (draft sessions only)
3. Repeated cautious runs dedupe open source requests for the same session/source/cutoff

**UI:** Agent run panel on session page; agent list at `/forecast/agents`

---

## 7. Source requests

Queue missing or thin evidence for local fulfillment.

1. **Create (on session):** `POST .../source-requests`
2. **Fulfill:** `POST /api/forecast/source-requests/{id}/fulfill` with local path or adapter
3. **Regenerate evidence snapshot** after fulfillment
4. Post-lock requests are flagged `too_late_for_forecast`

**UI:** `/forecast/source-requests`

---

## 8. Comparisons

Side-by-side replay of multiple agents on the same question.

1. **Create:** `POST /api/forecast/replay/comparisons`
   ```json
   { "template_id": "...", "target": "USA", "year": 2010, "agent_ids": ["a", "b"] }
   ```
2. Lock/resolve/score each comparison session
3. **View:** `GET /api/forecast/replay/comparisons/{comparison_group_id}`

**UI:** `/forecast/replay/comparisons/{comparison_group_id}`

---

## 9. Tournaments

Batch-evaluate agents across templates/targets/years.

1. **Create:** `POST /api/forecast/tournaments`
2. **Run:** `POST /api/forecast/tournaments/{id}/run` (conservative defaults: no auto-lock unless enabled)
3. **Score:** `POST .../score` (if not auto-scored)
4. **Summary:** `GET .../summary`
5. **Export report:** `GET .../export` → writes `report.v1.json` locally

Re-running a completed tournament retains existing session ids (idempotent).

**UI:** `/forecast/tournaments` and `/forecast/tournaments/{tournament_id}`

---

## 10. Strategy tuning proposals

Display-only suggestions from tournament summaries; explicit accept/reject required.

1. **Generate:** `POST /api/forecast/tournaments/{id}/tuning-proposals`
2. **List:** `GET .../tuning-proposals`
3. **Accept:** `POST /api/forecast/agents/{agent_id}/tuning-proposals/{proposal_id}/accept` — creates a **new versioned strategy**, archives the previous
4. **Reject:** `POST .../reject` — no strategy change

Proposals are never auto-applied.

---

## Quick reference: happy path

```
Create agent → Create session → Evidence snapshot
  → (optional) Source request → Fulfill → Re-snapshot
  → Agent run → Apply draft (or manual PATCH)
  → Lock → Resolve → Score → Judge → Postmortem
  → Recompute agent performance
```

For batch evaluation: create comparison or tournament → run lifecycle per session → export report → review tuning proposals.

---

## Verification

Run the full stack smoke test (dev server required):

```bash
npm run dev
npm run forecast:e2e-smoke
```

Local copy also at `tmp/forecast-full-e2e-smoke.mjs` (gitignored).

See also `docs/FORECASTING_MERGE_PLAN.md` for branch merge strategy.
