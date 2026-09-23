# Earth Hazard Tracker v1.7 — No-Key Dark Map

## What changed

- Removed the CARTO basemap dependency.
- Switched to **OpenFreeMap Dark**:
  - `https://tiles.openfreemap.org/styles/dark`
  - no API key
  - no registration
- Kept the dark visual theme.
- Kept the Map Brightness control using an in-app dimmer layer.
- Kept the v1.6 Zodiacal Compass rendering fix.
- Kept all collapsible widgets.

## Zodiacal Compass

The compass remains enabled by default and includes:
- sidereal / Lahiri
- ASC east / DSC west
- 12 signs
- 27 nakshatras
- 12 houses
- N / NE / E / SE / S / SW / W / NW
- Sun through Pluto
- Rahu and Ketu
- opacity control
- planet highlighting
- time controls
- great-circle lines over the globe

## Environment variables

None are required for the basemap or compass.

## Data sources

- OpenFreeMap / OpenStreetMap for the basemap
- USGS for earthquakes
- GDACS for hazard events
- Open-Meteo for weather / model data

## Install

Replace the existing repository files with the contents of this package, then commit. Vercel should redeploy automatically.
