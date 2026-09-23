const LEVELS = [1000, 925, 850, 700, 500, 300];
const G = 9.80665;
const VALID_HOURS = new Set([0, 6, 12, 24, 48, 72]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const requestedHour = Number(req.query?.hour ?? 0);
    const targetHour = VALID_HOURS.has(requestedHour) ? requestedHour : 0;

    const points = buildGlobalGrid();
    const batches = chunk(points, 12);
    const all = [];

    for (const batch of batches) {
      const result = await fetchBatch(batch, targetHour);
      all.push(...result);
    }

    const active = all
      .filter(x => Number.isFinite(x.ivt) && x.ivt >= 250)
      .sort((a, b) => b.ivt - a.ivt);

    res.status(200).json({
      generated_at: new Date().toISOString(),
      target_hour: targetHour,
      threshold: 250,
      units: 'kg m-1 s-1',
      method: 'Approximate IVT from GFS pressure-level temperature, RH, wind speed and direction at 1000/925/850/700/500/300 hPa.',
      grid_note: 'Coarse global screening grid (~30° longitude spacing across selected mid-latitudes). Not an official AR warning product.',
      points: active
    });
  } catch (error) {
    res.status(500).json({
      error: 'Atmospheric river scan failed',
      detail: error?.message || String(error)
    });
  }
}

function buildGlobalGrid() {
  const lats = [-50, -35, -20, 20, 35, 50];
  const lons = [];
  for (let lon = -165; lon <= 165; lon += 30) lons.push(lon);

  const points = [];
  for (const lat of lats) {
    for (const lon of lons) {
      points.push({ lat, lon });
    }
  }
  return points;
}

async function fetchBatch(batch, targetHour) {
  const latitudes = batch.map(p => p.lat).join(',');
  const longitudes = batch.map(p => p.lon).join(',');

  const vars = [];
  for (const level of LEVELS) {
    vars.push(
      `temperature_${level}hPa`,
      `relative_humidity_${level}hPa`,
      `wind_speed_${level}hPa`,
      `wind_direction_${level}hPa`
    );
  }

  const params = new URLSearchParams({
    latitude: latitudes,
    longitude: longitudes,
    hourly: vars.join(','),
    forecast_hours: '73',
    wind_speed_unit: 'ms',
    timezone: 'GMT',
    cell_selection: 'nearest'
  });

  const response = await fetch(`https://api.open-meteo.com/v1/gfs?${params}`, {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Open-Meteo GFS HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const locations = Array.isArray(json) ? json : [json];
  const results = [];

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    const sourcePoint = batch[i] || {
      lat: location.latitude,
      lon: location.longitude
    };

    const hourly = location.hourly || {};
    const times = hourly.time || [];
    if (!times.length) continue;

    const ivtSeries = [];
    for (let t = 0; t < times.length; t++) {
      ivtSeries.push(computeIVTAtIndex(hourly, t));
    }

    const targetIndex = Math.max(
      0,
      Math.min(targetHour, ivtSeries.length - 1)
    );

    const current = ivtSeries[targetIndex];
    if (!Number.isFinite(current.ivt)) continue;

    const segment = contiguousARSegment(ivtSeries, targetIndex);
    const maxIvt = segment
      ? Math.max(...ivtSeries.slice(segment.start, segment.end + 1).map(x => x.ivt))
      : current.ivt;

    const durationHours = segment ? (segment.end - segment.start + 1) : 0;
    const category = approximateARCategory(maxIvt, durationHours);

    results.push({
      lat: Number(sourcePoint.lat),
      lon: Number(sourcePoint.lon),
      valid_time: times[targetIndex],
      ivt: round(current.ivt, 1),
      transport_direction: round(current.direction, 0),
      duration_hours: durationHours,
      max_ivt_event: round(maxIvt, 1),
      ar_category: category,
      intensity: intensityName(maxIvt),
      short_duration: durationHours > 0 && durationHours < 24
    });
  }

  return results;
}

function computeIVTAtIndex(hourly, index) {
  let integratedU = 0;
  let integratedV = 0;
  let validLayers = 0;

  for (let i = 0; i < LEVELS.length - 1; i++) {
    const p1 = LEVELS[i];
    const p2 = LEVELS[i + 1];

    const a = layerValues(hourly, p1, index);
    const b = layerValues(hourly, p2, index);

    if (!a || !b) continue;

    const dpPa = Math.abs(p1 - p2) * 100;
    integratedU += 0.5 * (a.q * a.u + b.q * b.u) * dpPa / G;
    integratedV += 0.5 * (a.q * a.v + b.q * b.v) * dpPa / G;
    validLayers++;
  }

  if (validLayers < 3) return { ivt: NaN, direction: NaN };

  const ivt = Math.hypot(integratedU, integratedV);
  const direction = vectorToBearing(integratedU, integratedV);

  return { ivt, direction };
}

function layerValues(hourly, pressure, index) {
  const t = num(hourly[`temperature_${pressure}hPa`]?.[index]);
  const rh = num(hourly[`relative_humidity_${pressure}hPa`]?.[index]);
  const speed = num(hourly[`wind_speed_${pressure}hPa`]?.[index]);
  const dir = num(hourly[`wind_direction_${pressure}hPa`]?.[index]);

  if (![t, rh, speed, dir].every(Number.isFinite)) return null;

  const q = specificHumidity(t, rh, pressure);
  if (!Number.isFinite(q)) return null;

  // Meteorological direction is where wind comes FROM.
  const rad = dir * Math.PI / 180;
  const u = -speed * Math.sin(rad);
  const v = -speed * Math.cos(rad);

  return { q, u, v };
}

function specificHumidity(tempC, rhPercent, pressureHpa) {
  // Bolton-style saturation vapor pressure approximation over water.
  const es = 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
  const e = Math.max(0, Math.min(es, (rhPercent / 100) * es));
  const epsilon = 0.622;
  return (epsilon * e) / (pressureHpa - (1 - epsilon) * e);
}

function vectorToBearing(u, v) {
  // Direction transport is going TOWARD.
  let deg = Math.atan2(u, v) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function contiguousARSegment(series, index) {
  if (!series[index] || series[index].ivt < 250) return null;

  let start = index;
  let end = index;

  while (start > 0 && series[start - 1]?.ivt >= 250) start--;
  while (end < series.length - 1 && series[end + 1]?.ivt >= 250) end++;

  return { start, end };
}

function approximateARCategory(maxIvt, durationHours) {
  if (maxIvt < 250 || durationHours <= 0) return 0;

  let cat;
  if (maxIvt < 500) cat = 1;
  else if (maxIvt < 750) cat = 2;
  else if (maxIvt < 1000) cat = 3;
  else if (maxIvt < 1250) cat = 4;
  else cat = 5;

  if (durationHours < 24) cat -= 1;
  else if (durationHours > 48) cat += 1;

  return Math.max(0, Math.min(5, cat));
}

function intensityName(ivt) {
  if (ivt < 250) return 'Below AR threshold';
  if (ivt < 500) return 'Weak';
  if (ivt < 750) return 'Moderate';
  if (ivt < 1000) return 'Strong';
  if (ivt < 1250) return 'Extreme';
  return 'Exceptional';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function round(v, digits = 0) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
