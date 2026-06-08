# ACLED raw staging

Drop the official ACLED export here (CSV from myACLED data export tool).

Transform:

```bash
npm run kb:transform-batch1 -- --source acled
```

Output: `data/manual_imports/acled/acled_events.csv`

Filter: MVP countries; bilateral rows preserved when both countries are in an MVP relationship pair.
