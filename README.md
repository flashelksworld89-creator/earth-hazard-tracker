# Earth Hazard Tracker v1.9 — Corrected OpenFreeMap Build

## Critical fix

Earlier builds still contained leftover CARTO URLs in `app.js`, which is why the site continued to display an API-key requirement.

This build removes CARTO completely.

The map now initializes directly with the official OpenFreeMap style:

`https://tiles.openfreemap.org/styles/liberty`

OpenFreeMap's public service requires no API key and no registration.

## Dark appearance

The app keeps the dark presentation with its own semi-transparent dimming layer above the OpenFreeMap basemap and below the hazard / zodiac overlays.

The Map Brightness slider controls that dimming layer.

## Zodiacal Compass

The compass rendering fix remains included:
- visible by default
- header ON/OFF button
- layer toggle
- great-circle lines
- sidereal / Lahiri
- ASC / DSC
- 12 signs
- 27 nakshatras
- 12 houses
- planets + Rahu/Ketu
- collapsible panel

## Environment variables

No basemap environment variable or API key is required.

## Install

Replace all current repository files with this package, then commit and let Vercel redeploy.
