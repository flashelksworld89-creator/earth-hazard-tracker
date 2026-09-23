# Earth Hazard Tracker v1.3 — Global Zodiacal Compass

This version adds a globe-scale Zodiacal Compass to the existing worldwide hazard tracker.

## New Zodiacal Compass features

- Toggle the entire Zodiacal Compass on/off
- Sidereal zodiac using Lahiri ayanamsa conversion
- ASC and DSC with degree readouts
- ASC fixed to geographic East and DSC fixed to geographic West
- 12 zodiac sign boundaries
- 27 nakshatra boundaries and labels
- 12 equal 30° house divisions from the Ascendant
- Physical N / NE / E / SE / S / SW / W / NW reference lines
- Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
- Rahu and Ketu
- Planet degree labels
- Select a planet to highlight its global direction
- Opacity control
- Forward/backward time controls:
  - −1 day
  - −1 hour
  - NOW
  - +1 hour
  - +1 day
- Use the current map center as the compass origin
- Shift+Click anywhere on Earth to move the compass origin
- Geodesic great-circle geometry extending across the globe

## Mathematical/geographic behavior

The overlay does not draw simple straight lines on a flat map.

Every zodiac, nakshatra, house, direction, and planet ray is sampled as a spherical great-circle path using an Earth radius of 6371.0088 km. The rays extend nearly to the antipode, so the compass can cross oceans and continents while following Earth curvature.

The compass relationship is:

- Ascendant = East
- Descendant = West
- zodiac longitude increases counterclockwise around the geographic compass

## Astronomy

Planetary geocentric ecliptic coordinates are calculated in the browser with Astronomy Engine 2.1.19, then converted from tropical to sidereal longitude.

Rahu uses the mean ascending lunar node; Ketu is 180° opposite.

Lahiri ayanamsa is calculated from a J2000 Lahiri anchor with an IAU-2006-style general-precession polynomial.

## Important precision note

"Mathematical precision" here refers to the geometry and astronomy calculations used by this implementation, not to a claim of official ephemeris or surveying certification.

Astronomy Engine documents planetary positional accuracy of about ±1 arcminute for supported bodies. The Lahiri conversion and mean lunar-node calculation are implemented locally and may differ slightly from Swiss Ephemeris or specific panchanga software.

The globe itself uses a spherical great-circle model. For exact cadastral/geodetic surveying over Earth, an ellipsoidal WGS84 geodesic solver would be the next upgrade.

## Existing v1.2 features retained

- Interactive 3D globe / flat map
- USGS earthquakes
- GDACS tropical cyclones, volcanoes, floods, wildfires and droughts
- Open-Meteo weather
- Approximate atmospheric-river IVT layer
- 1–30 day event window
- automatic refresh
- search and hazard filters

## Deployment

Upload/replace all repository files, including the new:

- `zodiac.js`

Keep:

- `api/gdacs.js`
- `api/atmospheric-rivers.js`

No environment variables are required.
