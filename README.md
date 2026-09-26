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


## v1.17 atmospheric energy
- NOAA SWPC planetary Kp, real-time solar-wind speed/density, IMF Bz/Bt.
- NOAA GloTEC proxy endpoint for ionosphere data.
- Existing atmospheric / space-energy panel retained and upgraded rather than replacing the newer transit-map UI.
- Five-minute atmospheric refresh.
- Physical NOAA measurements remain separate from astrology overlays.
- GLM lightning is represented without generating synthetic strike locations.


## v1.18 Weather Storm Agent
- New /weather.html page modeled after the Aviation Agent.
- NOAA IBTrACS hurricane-strength tropical cyclone history from January 1, 2025 forward.
- NOAA Storm Events heavy-rain history, with rainfall totals extracted when explicitly reported.
- NOAA Stage IV current 24-hour QPE availability/status.
- Moon phase, Lahiri sidereal Moon zodiac/nakshatra, and Venus-Moon major aspect calculated at each event or cyclone peak timestamp.
- Monthly frequency reports and strongest/heaviest vs lower-intensity quartile comparisons.
