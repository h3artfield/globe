# Forecasting data (local file-based)

Artifacts for the probabilistic forecasting sandbox. No external database.

## Layout

- `templates/replay/` — static Historical Replay question definitions (Phase 1+)
- `sessions/` — player replay sessions and forecast records (Phase 3+)
- `resolutions/` — holdout outcome lookups, hidden until submit (Phase 2+)
- `evidence_snapshots/` — cutoff-safe evidence bundles at submission (Phase 2+)
- `audits/` — leakage audit records (Phase 2+)
- `scorecards/` — per-forecast and agency aggregates (Phase 3+)
- `postmortems/` — lesson artifacts (Phase 4+)
- `judges/` — judge verdicts (Phase 4+)

## No-leak rule

Historical Replay must only use evidence with observation date/year at or before the forecast `as_of` cutoff. RAG prose, embeddings, and undated summaries are excluded from replay retrieval.

See `docs/FORECASTING_TECHNICAL_PLAN.md` for full design.
