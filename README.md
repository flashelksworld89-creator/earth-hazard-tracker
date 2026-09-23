# Earth Hazard Tracker v1.15 — Vercel API Route Fix

## Why v1.14 could fail deployment

Vercel's documented zero-config Node Function convention uses JavaScript files such as:

`api/my-function.js`

v1.14 used `.cjs` files in `/api`. While `.cjs` is valid Node syntax, it is not the normal documented Vercel `/api` route convention and can fail route/function detection or configuration.

## Fix in v1.15

All API files now use `.js` filenames:

- `api/gdacs.js`
- `api/atmospheric-rivers.js`
- `api/ephemeris.js`

Internally they still use CommonJS:

`module.exports = async function handler(...) { ... }`

`package.json` does NOT contain `"type": "module"`, so Node parses those server files as CommonJS and does not choke on `export`.

Client URLs are back to clean routes:

- `/api/gdacs`
- `/api/atmospheric-rivers`
- `/api/ephemeris`

Node is set to 22.x.

## Retained features

- OpenFreeMap no-key basemap
- dark interface
- collapsible widgets
- earthquakes and GDACS hazards
- atmospheric river layer
- Zodiacal Compass
- geocentric sidereal planetary transits
- Lahiri conversion
- mean Rahu/Ketu
- unique zodiac colors
- unique planet colors

## Environment variables

None required.
