# Earth Hazard Tracker v1.16 — Browser Ephemeris Recovery

This build removes the ephemeris Vercel function and the astronomy-engine npm dependency entirely.

The app returns to the last stable Vercel server structure:
- api/gdacs.js
- api/atmospheric-rivers.js

Astronomy Engine 2.1.19 now runs directly in the browser via its browser build.

Compass features:
- current geocentric Sun through Pluto transits
- sidereal Lahiri conversion
- mean Rahu and Ketu
- forward/backward transit time controls
- unique color for every zodiac sign
- unique color for every planet/node
- global great-circle projection
- ASC east / DSC west
- 27 nakshatras
- 12 houses

No ephemeris API route, npm astronomy dependency, API key, or new environment variable is required.
