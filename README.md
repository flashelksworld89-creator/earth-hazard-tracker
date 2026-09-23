# Earth Hazard Tracker v1.8 — OpenFreeMap Rendering Fix

## What was fixed

The previous build used an OpenFreeMap `dark` style URL that was not the style URL shown in OpenFreeMap's current official quick-start documentation.

This version uses the officially documented style:

`https://tiles.openfreemap.org/styles/liberty`

Then the app applies its own darkening layer above the basemap and below the weather/hazard/zodiac overlays.

## Result

- No API key
- No OpenFreeMap account
- Reliable official OpenFreeMap style URL
- Dark visual appearance preserved
- Zodiacal Compass stays bright above the dimmed map
- Hazard markers remain bright
- Map Brightness slider still works
- Collapsible widgets retained

## Diagnostics

The app now surfaces MapLibre style/source errors in the UI instead of failing silently.

## Environment variables

None required for the basemap.

## Install

Replace the current repository files with this package and commit. Vercel should redeploy automatically.
