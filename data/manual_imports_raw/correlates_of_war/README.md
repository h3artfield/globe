# Correlates of War raw staging

Drop official COW alliance and/or interstate war tables here.

Transform:

```bash
npm run kb:transform-batch1 -- --source correlates_of_war
```

Output: `data/manual_imports/correlates_of_war/cow_alliances_wars.csv`

Filter: dyads involving MVP countries; bilateral MVP relationship pairs preserved.
