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

## Aviation Moon aspect comparison (experimental)
The Aviation Agent now includes a separate 2026 date-only Moon aspect comparison panel.
- Switch between traditional sign-based Parashari aspects and modern angular aspects (8-degree orb).
- Compare crash/collision reports with other emergency reports, based on headline-derived categories.
- Rank aspects by observed incident share divided by the share of 2026 UTC calendar days with the same aspect at noon.
- Show an exposure-adjusted sidereal Moon sign comparison.
- Flag aspects that are not present at both UTC day endpoints when an incident has no reported event time.
- Keep existing Mars/Rahu 8-degree Jyotish cards and original Moon zodiac/nakshatra charts unchanged.

The new panel is exploratory. Its baseline is calendar-day frequency, **not flight volume or aircraft exposure**. News-source coverage, duplicate events, missing incident times, and multiple incidents per date can bias comparisons. An enrichment ratio is not a causal effect or aviation safety prediction. The node model in the new classical panel uses seventh-house aspect only; the legacy Rahu cards retain their separate fifth/seventh/ninth convention.

## Aviation incident duplicate audit
The Aviation Agent now has an **Incident Duplicate Audit** section. Exact article keys remain filtered. New articles with the same reported aircraft registration, UTC date and crash/emergency category (or matching flight number and location) are archived as strong matches instead of counted again. Ambiguous matches are **not** automatically merged. Historical incident pairs are shown for manual review, with a full JSON backup export and an undo-last-consolidation control. The original second article is retained in browser local storage.

Important: Existing article records live in browser local storage (limited to 1,000 active entries); duplicate archives and backups are browser-specific. A cleared browser or another device will not share review decisions. The server-side observations feed is not retroactively deduplicated. Timezones, missing registration identifiers, vague locations, and news reporting errors can still produce false negatives or false positives. Review candidate pairs before consolidating and export a backup first.
