# Earth Hazard Tracker v1.11 — Ephemeris Server Fix

This version fixes the Vercel `/api/ephemeris` `FUNCTION_INVOCATION_FAILED` error.

## Fix

Astronomy Engine is now loaded dynamically inside the serverless request handler and supports both ESM and CommonJS export shapes:

- `mod.default`
- named module exports

The function also validates that `GeoVector`, `Ecliptic`, and `Body` are available before calculating transits.

If the endpoint fails again, it now returns a useful JSON error message instead of crashing with only `FUNCTION_INVOCATION_FAILED`.

## Compass behavior retained

- true geocentric transit calculation through Astronomy Engine
- sidereal Lahiri conversion
- current-time and forward/backward transit requests
- mean Rahu / Ketu
- unique zodiac sign colors
- unique planet colors
- global great-circle compass
- OpenFreeMap no-key map

## Deployment

Replace all repository files with this package and commit. Vercel will install `astronomy-engine` from `package.json`.

No API key or environment variable is required.
