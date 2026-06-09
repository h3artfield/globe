# UN Comtrade raw staging

Drop the official UN Comtrade / Comtrade Plus export here.

Transform: `npm run kb:transform-batch1 -- --source un_comtrade`

Output: `data/manual_imports/un_comtrade/un_comtrade_bilateral.csv`

Archived raw files live under `data/manual_imports_raw/_archive/un_comtrade/`.
If a copy exists there, the active staging copy is ignored by the transform.
