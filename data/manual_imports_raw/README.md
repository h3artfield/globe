# Raw manual import staging (Batch 1)

Drop **official exports** here before transform. Do not commit large raw files unless explicitly approved.

## Flow

```
data/manual_imports_raw/{source}/   ← official download
        ↓  npm run kb:transform-batch1 -- --source {source}
data/manual_imports/{source}/       ← canonical CSV for validators/ingest
        ↓  kb:validate-imports / kb:validate-events
        ↓  source:ingest
```

Validators only read **canonical** files under `data/manual_imports/`, not raw staging.

See `data/source_requests/BATCH_1_SHARED_DATASETS.md` for acquisition links and filtering notes.
