# Source receipts

Provenance records for Batch 1 raw downloads and canonical transforms.

Each source has a receipt file:

```
data/source_receipts/{source}.source_receipts.v1.json
```

Receipts are created/updated by `npm run kb:transform-batch1`.

Check status before ingest:

```bash
npm run kb:receipts
```

Manual fields (`collected_at`, `collected_by`, `notes`) may be edited in the receipt JSON after download.
