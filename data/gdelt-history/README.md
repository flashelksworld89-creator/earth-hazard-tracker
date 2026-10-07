# GDELT historical event indexes

This directory contains compact daily summaries generated from the GDELT 1.0 Event Database for 1980-2013.

The live site reads these small JSON files instead of downloading raw annual/monthly GDELT archives during requests.

Generate a year with:

```
python3 scripts/build-gdelt-history.py --year 1980
```

The GitHub Actions workflow `Build GDELT Historical Index` can build one year or all years.

Historical event results are intentionally kept distinct from modern headline results. They use CAMEO event coding, event/mention/source/article counts, Goldstein scores, tone, actors, and locations. They should not be interpreted as a complete headline archive.
