import * as Astronomy from 'astronomy-engine';

const PLANETS = [
  ['Sun', Astronomy.Body.Sun, '☉'],
  ['Moon', Astronomy.Body.Moon, '☽'],
  ['Mercury', Astronomy.Body.Mercury, '☿'],
  ['Venus', Astronomy.Body.Venus, '♀'],
  ['Mars', Astronomy.Body.Mars, '♂'],
  ['Jupiter', Astronomy.Body.Jupiter, '♃'],
  ['Saturn', Astronomy.Body.Saturn, '♄'],
  ['Uranus', Astronomy.Body.Uranus, '♅'],
  ['Neptune', Astronomy.Body.Neptune, '♆'],
  ['Pluto', Astronomy.Body.Pluto, '♇']
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const raw = req.query?.time;
    const date = raw ? new Date(raw) : new Date();

    if (!Number.isFinite(date.getTime())) {
      return res.status(400).json({ error: 'Invalid time' });
    }

    const ayanamsa = lahiriAyanamsa(date);

    const placements = PLANETS.map(([name, body, glyph]) => {
      const vec = Astronomy.GeoVector(body, date, true);
      const ecl = Astronomy.Ecliptic(vec);
      const tropical = normalize360(ecl.elon);
      const sidereal = normalize360(tropical - ayanamsa);

      return {
        name,
        glyph,
        tropical_longitude: round(tropical, 8),
        sidereal_longitude: round(sidereal, 8),
        ecliptic_latitude: round(ecl.elat, 8)
      };
    });

    const rahuTropical = meanAscendingNode(date);
    const rahuSidereal = normalize360(rahuTropical - ayanamsa);

    placements.push({
      name: 'Rahu',
      glyph: '☊',
      tropical_longitude: round(rahuTropical, 8),
      sidereal_longitude: round(rahuSidereal, 8),
      ecliptic_latitude: 0,
      node_type: 'mean'
    });

    placements.push({
      name: 'Ketu',
      glyph: '☋',
      tropical_longitude: round(normalize360(rahuTropical + 180), 8),
      sidereal_longitude: round(normalize360(rahuSidereal + 180), 8),
      ecliptic_latitude: 0,
      node_type: 'mean'
    });

    return res.status(200).json({
      timestamp_utc: date.toISOString(),
      zodiac: 'sidereal',
      ayanamsa: 'Lahiri',
      ayanamsa_degrees: round(ayanamsa, 8),
      observer_frame: 'geocentric',
      node: 'mean',
      placements
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Ephemeris calculation failed',
      detail: error?.message || String(error)
    });
  }
}

function lahiriAyanamsa(date) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525.0;

  // Lahiri anchor at J2000 with general precession polynomial.
  // Kept consistent with the compass ASC conversion.
  const arcsec =
    85885.53 +
    5028.796195 * T +
    1.1054348 * T*T +
    0.00007964 * T*T*T;

  return arcsec / 3600;
}

function meanAscendingNode(date) {
  const T = (julianDate(date) - 2451545.0) / 36525.0;
  return normalize360(
    125.0445479 -
    1934.1362891*T +
    0.0020754*T*T +
    T*T*T/467441 -
    T*T*T*T/60616000
  );
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function normalize360(x) {
  return ((x % 360) + 360) % 360;
}

function round(v, digits) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
