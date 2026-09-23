# Earth Hazard Tracker v1.14 — Unified Vercel Server Fix

## Root cause

Previous builds mixed two incompatible server module systems:

- `api/ephemeris.cjs` used CommonJS
- `api/gdacs.js` and `api/atmospheric-rivers.js` still used `export default`
- `package.json` no longer declared ESM

That can make Vercel parse one or more server functions incorrectly and cause:
- `Unexpected token 'export'`
- `FUNCTION_INVOCATION_FAILED`
- deployment failures

## Fix in v1.14

All Vercel server functions now use one format: CommonJS `.cjs`.

Files:
- `api/gdacs.cjs`
- `api/atmospheric-rivers.cjs`
- `api/ephemeris.cjs`

All use `module.exports`.

The browser app now calls those exact `.cjs` endpoints.

The ephemeris function uses:
`require('astronomy-engine')`

Astronomy Engine's own Node documentation supports CommonJS `require`, avoiding the broken ESM resolution path.

## Retained features

- OpenFreeMap no-key basemap
- dark graphics
- collapsible widgets
- earthquakes / GDACS hazards
- atmospheric river scan
- Zodiacal Compass
- current geocentric sidereal transits
- Lahiri conversion
- mean Rahu/Ketu
- unique zodiac colors
- unique planet colors

## Environment variables

None required.
