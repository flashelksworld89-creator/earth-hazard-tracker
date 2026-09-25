const SOURCES = {
  kp: 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  wind: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
  mag: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'
};

async function getJson(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Earth-Hazard-Tracker/1.17' },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

function latestValid(rows, candidates) {
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i] || {};
    const out = {};
    let valid = false;
    for (const [name, keys] of Object.entries(candidates)) {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          const n = Number(row[key]);
          out[name] = Number.isFinite(n) ? n : row[key];
          valid = true;
          break;
        }
      }
    }
    if (valid) {
      out.time = row.time_tag || row.time || row.timestamp || row.datetime || null;
      return out;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=90');
  try {
    const [kpRows, windRows, magRows] = await Promise.all([
      getJson(SOURCES.kp), getJson(SOURCES.wind), getJson(SOURCES.mag)
    ]);

    const kp = latestValid(kpRows, { value: ['kp_index', 'kp', 'estimated_kp', 'Kp'] });
    const wind = latestValid(windRows, {
      speed: ['speed', 'bulk_speed', 'proton_speed'],
      density: ['density', 'proton_density', 'dens'],
      temperature: ['temperature', 'temp']
    });
    const mag = latestValid(magRows, {
      bz: ['bz_gsm', 'bz', 'Bz'],
      bt: ['bt', 'total_field', 'b_total'],
      bx: ['bx_gsm', 'bx'],
      by: ['by_gsm', 'by']
    });

    res.status(200).json({ ok:true, fetchedAt:new Date().toISOString(), kp, wind, mag, sources:SOURCES });
  } catch (error) {
    console.error('space-weather error', error);
    res.status(502).json({ ok:false, error:String(error?.message || error) });
  }
}
