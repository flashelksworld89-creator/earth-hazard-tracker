# Earth Hazard Tracker v1.13 — Direct CommonJS Astronomy Build

## Why v1.12 still failed

Vercel was still resolving the `astronomy-engine` package through an ESM path, which produced:

`Unexpected token 'export'`

## Fix in v1.13

The ephemeris function no longer imports the package by its default entry point.

It now directly requires Astronomy Engine's precompiled Node/CommonJS build:

`astronomy-engine/astronomy.min.js`

That file is compiled for Node/browser use and uses CommonJS exports internally.

The accurate geocentric transit calculations remain the same:
- Sun through Pluto
- Lahiri sidereal conversion
- mean Rahu/Ketu
- forward/backward transit time controls
- unique zodiac and planet colors

No API key or environment variable is required.
