# unesco_uis manual imports

Drop source CSV or JSON files here, then run:

`npm run source:ingest -- unesco_uis`

Expected columns include: country_code, year, metric_id, value, unit, source_url, source_name, raw_record_id, calculation, notes. WVS demographic files may also include sample_size, question_wording, response_mapping, demographic_cut, demographic_group.
