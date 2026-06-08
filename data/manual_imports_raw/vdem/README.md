# V-Dem raw staging

Drop the official **V-Dem Country-Year** export here (`.csv`, `.json`, or `.jsonl`).

Expected raw format: wide CSV with `country_text_id` or `country_name`, `year`, and `v2x_*` indicator columns.

Transform:

```bash
npm run kb:transform-batch1 -- --source vdem
```

Output: `data/manual_imports/vdem/vdem_country_year.csv`

Filter: rows are kept only for MVP countries (USA, CHN, EGY, ETH, RUS, UKR, IND, PAK, ISR, IRN, SAU, TUR).
