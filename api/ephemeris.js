export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Dynamic import is more reliable across Vercel's ESM/CommonJS serverless runtime.
    const mod = await import('astronomy-engine');
    const Astronomy = mod.default ?? mod;

    if (!Astronomy?.GeoVector || !Astronomy?.Ecliptic || !Astronomy?.Body) {
      throw new Error(
        `Astronomy Engine loaded but expected exports are missing. Available: ${Object.keys(Astronomy || {}).slice(0, 20).join(', ')}`
      );
    }

    const raw = req.query?.time;
    const date = raw ? new Date(raw) : new Date();

    if (!Number.isFinite(date.getTime())) {
      return res.status(400).json({ error: 'Invalid time' });
    }

    const ayanamsa = lahiriAyanamsa(date);

    const planetDefs = [
      ['Sun', 'Sun', '☉'],
      ['Moon', 'Moon', '☽'],
      ['Mercury', 'Mercury', '☿'],
      ['Venus', 'Venus', '♀'],
      ['Mars', 'Mars', '♂'],
      ['Jupiter', 'Jupiter', '♃'],
      ['Saturn', 'Saturn', '♄'],
      ['Uranus', 'Uranus', '♅'],
      ['Neptune', 'Neptune', '♆'],
      ['Pluto', 'Pluto', '♇']
    ];

    const placements = [];

    for (const [name, bodyKey, glyph] of planetDefs) {
      const body = Astronomy.Body[bodyKey];

      if (body === undefined || body === null) {
        throw new Error(`Astronomy Engine body not found: ${bodyKey}`);
      }

      const vec = Astronomy.GeoVector(body, date, true);
      const ecl = Astronomy.Ecliptic(vec);

      const tropical = normalize360(Number(ecl.elon));
      const sidereal = normalize360(tropical - ayanamsa);

      placements.push({
        name,
        glyph,
        tropical_longitude: round(tropical, 8),
        sidereal_longitude: round(sidereal, 8),
        ecliptic_latitude: round(Number(ecl.elat), 8)
      });
    }

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
      ok: true,
      timestamp_utc: date.toISOString(),
      zodiac: 'sidereal',
      ayanamsa: 'Lahiri',
      ayanamsa_degrees: round(ayanamsa, 8),
      observer_frame: 'geocentric',
      node: 'mean',
      engine: 'astronomy-engine',
      engine_version: '2.1.19',
      placements
    });
  } catch (error) {
    console.error('EPHEMERIS_ERROR', error);

    // Return JSON instead of allowing the function to crash without a useful body.
    return res.status(500).json({
      ok: false,
      error: 'Ephemeris calculation failed',
      detail: error?.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
}

function lahiriAyanamsa(date) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525.0;

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
