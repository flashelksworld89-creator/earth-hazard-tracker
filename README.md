# Earth Hazard Tracker v1.4

## Fixes

- Fixed Zodiacal Compass initialization so it no longer depends on a third-party astronomy script loading successfully.
- The compass now uses a self-contained browser calculation layer and visibly reports errors instead of failing silently.
- Great-circle globe geometry remains in place.
- Zodiacal Compass is still toggleable from Layers.

## New UI feature

Every major screen panel is now collapsible:

- Layers
- Live Events
- Zodiacal Compass
- Atmospheric Rivers
- Auto Refresh
- Timeline
- Details

Use the `−` button in a panel header to collapse it and `+` to reopen it.

## Compass features retained

- Sidereal / Lahiri
- ASC east / DSC west
- 12 signs
- 27 nakshatras
- 12 houses
- N, NE, E, SE, S, SW, W, NW
- Sun through Pluto
- Rahu and Ketu
- planet highlighting
- opacity control
- time forward/backward
- map-center origin or click-to-set origin
- continent-spanning great-circle projection

## Important astronomy note

The v1.4 fallback planetary calculations are intentionally self-contained and robust, but the planetary longitudes are lower precision than a full ephemeris engine. The ASC, sidereal rotation, and geographic great-circle projection remain computed mathematically in-browser.

A later precision upgrade can switch the planets to Swiss Ephemeris or a server-side JPL/ephemeris source while keeping this now-stable rendering system.

No environment variables are required.
