# UCDP raw staging

Drop the official UCDP download here (e.g. GED events or conflict dyad export).

Transform:

```bash
npm run kb:transform-batch1 -- --source ucdp
```

Output: `data/manual_imports/ucdp/ucdp_conflict.csv`

Filter: MVP countries and MVP bilateral dyads where mappable from UCDP/COW country codes.
