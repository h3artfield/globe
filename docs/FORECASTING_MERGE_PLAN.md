# Forecast Lab Merge Plan

Integration hardening branch: `forecast-replay-integration-hardening` (from `forecast-replay-phase-11`).

---

## Branch stack (linear)

Phase branches were built sequentially; each phase branch contains all prior phase work:

| Branch | Tip commit (approx.) | Focus |
|--------|----------------------|-------|
| `forecast-replay-phase-1` | `19ac6bc` | Scaffold, types, templates |
| `forecast-replay-phase-2` | `68d85be` | Session engine |
| `forecast-replay-phase-3` | `3ee7fdb` | Draft save + lock |
| `forecast-replay-phase-4` | `67e7e19` | Evidence snapshots + resolution |
| `forecast-replay-phase-5` | `290604c` | Score, judge, postmortem |
| `forecast-replay-phase-6` | `191d40d` | Agent loop, source requests, idempotent scoring |
| `forecast-replay-phase-7` | `8d2c157` | Queue, leaderboard, comparisons |
| `forecast-replay-phase-8` | `18c48f3`* | Source fulfillment intake |
| `forecast-replay-phase-9` | `906c04b` | Deterministic agent runs |
| `forecast-replay-phase-10` | `18c48f3` | Tournaments |
| `forecast-replay-phase-11` | `63d24f8` | Export + tuning proposals |

\*Phase 8 final fix also appears on phase-10/11 via cherry-pick lineage.

**Commits from `main` → `forecast-replay-phase-11`:** 11 forecasting feature commits (Phases 1–11), linear history.

---

## Recommendation: one combined integration PR

**Use a single PR from `forecast-replay-phase-11` (or `forecast-replay-integration-hardening` after hardening) into `main`.**

### Why one PR is cleaner

1. **Linear dependency chain** — Each phase assumes the previous; there are no parallel independent features to review in isolation.
2. **No merge-base conflicts between phases** — Stacked branches share history; merging phase-3 then phase-7 would replay the same diffs already contained in phase-11.
3. **E2E only meaningful at the tip** — Tournaments, agent runs, and fulfillment require phases 1–10; partial merges leave broken intermediate states on `main`.
4. **Review cost** — Eleven sequential PRs multiply CI runs and re-review overlapping files (`forecasting.ts`, session store, API routes) without reducing risk.

### When stacked PRs would make sense

- If phases were developed in parallel on different bases
- If some phases were optional feature flags
- If reviewers required incremental rollout to production

None of these apply here.

---

## Suggested merge sequence

1. **Merge hardening branch** into `forecast-replay-phase-11` (or open PR from `forecast-replay-integration-hardening` → `main` if you prefer one branch name at merge time).
2. **Run on tip:**
   - `npm run typecheck`
   - `npm run pipeline:validate`
   - `npm run kb:status`
   - `node tmp/forecast-full-e2e-smoke.mjs`
3. **Single PR:** `forecast-replay-phase-11` → `main`
   - Title: *Add Historical Replay Forecast Lab (Phases 1–11)*
   - Body: link `docs/FORECASTING_USER_FLOW.md`, note runtime JSON gitignored, include E2E smoke pass
4. **Do not merge** until E2E smoke and manual UI spot-check pass on the PR branch.

---

## Post-merge cleanup

- Delete local/remote `forecast-replay-phase-*` branches after merge (optional)
- Keep `tmp/phase*-*.mjs` scripts locally for regression; `tmp/` is gitignored
- Runtime data under `data/forecasting/**` remains untracked by design

---

## Files touched (high level)

Forecast Lab adds primarily:

- `src/types/forecasting.ts`
- `src/lib/forecasting/**`
- `src/app/api/forecast/**`
- `src/app/forecast/**`
- `src/components/Forecast*.tsx`
- `data/forecasting/` scaffolds (templates tracked; runtime JSON ignored)
- `docs/FORECASTING_*.md`

Does **not** modify RAG retrieval paths, pilot packs, or generated country metrics beyond read-only evidence/resolution use.
