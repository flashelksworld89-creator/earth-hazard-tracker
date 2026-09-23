const EARTH_RADIUS_KM = 6371.0088;
const RAY_MAX_KM = 19800;
const RAY_STEP_KM = 180;

const SIGNS = [
  ['Aries','♈'], ['Taurus','♉'], ['Gemini','♊'], ['Cancer','♋'],
  ['Leo','♌'], ['Virgo','♍'], ['Libra','♎'], ['Scorpio','♏'],
  ['Sagittarius','♐'], ['Capricorn','♑'], ['Aquarius','♒'], ['Pisces','♓']
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
  'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
  'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha',
  'Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada',
  'Uttara Bhadrapada','Revati'
];

const PLANETS = [
  ['Sun','Sun','☉'],
  ['Moon','Moon','☽'],
  ['Mercury','Mercury','☿'],
  ['Venus','Venus','♀'],
  ['Mars','Mars','♂'],
  ['Jupiter','Jupiter','♃'],
  ['Saturn','Saturn','♄'],
  ['Uranus','Uranus','♅'],
  ['Neptune','Neptune','♆'],
  ['Pluto','Pluto','♇']
];

const DIRS = [
  [0,'N'], [45,'NE'], [90,'E'], [135,'SE'],
  [180,'S'], [225,'SW'], [270,'W'], [315,'NW']
];

export function initZodiacCompass(map, maplibregl) {
  const state = {
    enabled: false,
    origin: { lng: map.getCenter().lng, lat: map.getCenter().lat },
    timeOffsetMs: 0,
    opacity: 0.72,
    highlightedPlanet: '',
    shiftHint: false,
    lastData: null,
    minuteTimer: null
  };

  const ids = {
    signs: 'zodiac-sign-lines',
    nak: 'zodiac-nak-lines',
    houses: 'zodiac-house-lines',
    dirs: 'zodiac-direction-lines',
    planetLines: 'zodiac-planet-lines',
    labels: 'zodiac-labels',
    planets: 'zodiac-planets',
    origin: 'zodiac-origin'
  };

  addSourcesAndLayers();
  bindControls();
  refresh();

  state.minuteTimer = setInterval(() => {
    if (state.enabled && state.timeOffsetMs === 0) refresh();
  }, 60_000);

  function bindControls() {
    const toggle = document.getElementById('zodiacLayerToggle');
    toggle.addEventListener('change', () => {
      state.enabled = toggle.checked;
      document.getElementById('zodiacPanel').classList.toggle('hidden', !state.enabled);
      setVisibility();
      if (state.enabled) refresh();
    });

    document.getElementById('zodiacCloseBtn').addEventListener('click', () => {
      state.enabled = false;
      toggle.checked = false;
      document.getElementById('zodiacPanel').classList.add('hidden');
      setVisibility();
    });

    document.getElementById('zUseCenterBtn').addEventListener('click', () => {
      const c = map.getCenter();
      state.origin = { lng: c.lng, lat: c.lat };
      refresh();
    });

    document.getElementById('zUseHereBtn').addEventListener('click', () => {
      state.shiftHint = !state.shiftHint;
      showToast(state.shiftHint
        ? 'Hold Shift and click anywhere on the globe to set the Zodiacal Compass origin.'
        : 'Shift+Click origin mode cancelled.');
    });

    map.on('click', (e) => {
      if (!state.enabled) return;
      if (e.originalEvent?.shiftKey || state.shiftHint) {
        state.origin = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        state.shiftHint = false;
        e.originalEvent?.stopPropagation?.();
        refresh();
        showToast('Zodiacal Compass origin updated.');
      }
    });

    document.querySelectorAll('[data-ztime]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.timeOffsetMs += Number(btn.dataset.ztime) * 60_000;
        refresh();
      });
    });

    document.getElementById('zNowBtn').addEventListener('click', () => {
      state.timeOffsetMs = 0;
      refresh();
    });

    document.getElementById('zOpacity').addEventListener('input', (e) => {
      state.opacity = Number(e.target.value) / 100;
      updateOpacity();
    });

    document.getElementById('zPlanetSelect').addEventListener('change', (e) => {
      state.highlightedPlanet = e.target.value;
      redrawPlanetLines();
    });
  }

  function addSourcesAndLayers() {
    const empty = { type:'FeatureCollection', features:[] };
    const sources = [
      ids.signs, ids.nak, ids.houses, ids.dirs,
      ids.planetLines, ids.labels, ids.planets, ids.origin
    ];

    for (const id of sources) {
      if (!map.getSource(id)) {
        map.addSource(id, { type:'geojson', data: empty });
      }
    }

    if (!map.getLayer(ids.nak)) map.addLayer({
      id: ids.nak, type:'line', source:ids.nak,
      paint:{
        'line-color':'#67e8f9',
        'line-width':1,
        'line-opacity':0.35,
        'line-dasharray':[2,3]
      }
    });

    if (!map.getLayer(ids.signs)) map.addLayer({
      id: ids.signs, type:'line', source:ids.signs,
      paint:{
        'line-color':'#f0abfc',
        'line-width':2.2,
        'line-opacity':0.75
      }
    });

    if (!map.getLayer(ids.houses)) map.addLayer({
      id: ids.houses, type:'line', source:ids.houses,
      paint:{
        'line-color':'#fde68a',
        'line-width':1.3,
        'line-opacity':0.6,
        'line-dasharray':[5,3]
      }
    });

    if (!map.getLayer(ids.dirs)) map.addLayer({
      id: ids.dirs, type:'line', source:ids.dirs,
      paint:{
        'line-color':'#94a3b8',
        'line-width':1,
        'line-opacity':0.45,
        'line-dasharray':[1,4]
      }
    });

    if (!map.getLayer(ids.planetLines)) map.addLayer({
      id: ids.planetLines, type:'line', source:ids.planetLines,
      paint:{
        'line-color':[
          'case',
          ['==',['get','highlighted'],true],
          '#ffffff',
          '#c084fc'
        ],
        'line-width':[
          'case',
          ['==',['get','highlighted'],true],
          4,
          1.5
        ],
        'line-opacity':0.82
      }
    });

    if (!map.getLayer(ids.labels)) map.addLayer({
      id: ids.labels, type:'symbol', source:ids.labels,
      layout:{
        'text-field':['get','label'],
        'text-size':[
          'case',
          ['==',['get','kind'],'sign'], 12,
          ['==',['get','kind'],'direction'], 11,
          ['==',['get','kind'],'house'], 10,
          8
        ],
        'text-allow-overlap':false
      },
      paint:{
        'text-color':[
          'case',
          ['==',['get','kind'],'sign'],'#f5d0fe',
          ['==',['get','kind'],'direction'],'#e2e8f0',
          ['==',['get','kind'],'house'],'#fde68a',
          '#a5f3fc'
        ],
        'text-halo-color':'#06111f',
        'text-halo-width':1.4
      }
    });

    if (!map.getLayer(ids.planets)) map.addLayer({
      id: ids.planets, type:'symbol', source:ids.planets,
      layout:{
        'text-field':['get','label'],
        'text-size':16,
        'text-allow-overlap':true
      },
      paint:{
        'text-color':[
          'case',
          ['==',['get','highlighted'],true],
          '#ffffff',
          '#e9d5ff'
        ],
        'text-halo-color':'#190c26',
        'text-halo-width':1.8
      }
    });

    if (!map.getLayer(ids.origin)) map.addLayer({
      id: ids.origin, type:'circle', source:ids.origin,
      paint:{
        'circle-radius':7,
        'circle-color':'#ffffff',
        'circle-stroke-width':3,
        'circle-stroke-color':'#c084fc',
        'circle-opacity':0.95
      }
    });

    setVisibility();
  }

  function setVisibility() {
    const v = state.enabled ? 'visible' : 'none';
    for (const id of Object.values(ids)) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
    }
  }

  function updateOpacity() {
    if (!map.getLayer(ids.signs)) return;
    map.setPaintProperty(ids.signs, 'line-opacity', 0.78 * state.opacity);
    map.setPaintProperty(ids.nak, 'line-opacity', 0.42 * state.opacity);
    map.setPaintProperty(ids.houses, 'line-opacity', 0.65 * state.opacity);
    map.setPaintProperty(ids.dirs, 'line-opacity', 0.48 * state.opacity);
    map.setPaintProperty(ids.planetLines, 'line-opacity', 0.88 * state.opacity);
    map.setPaintProperty(ids.labels, 'text-opacity', state.opacity);
    map.setPaintProperty(ids.planets, 'text-opacity', state.opacity);
  }

  function refresh() {
    if (!window.Astronomy) {
      document.getElementById('zodiacStatus').textContent = 'Astronomy Engine unavailable';
      return;
    }

    const date = new Date(Date.now() + state.timeOffsetMs);
    const lat = clamp(state.origin.lat, -89.5, 89.5);
    const lng = normalizeLng(state.origin.lng);
    state.origin = { lat, lng };

    const aya = lahiriAyanamsa(date);
    const tropicalAsc = tropicalAscendant(date, lat, lng);
    const asc = normalize360(tropicalAsc - aya);
    const dsc = normalize360(asc + 180);
    const placements = computePlanets(date, aya);

    state.lastData = { date, aya, asc, dsc, placements };

    document.getElementById('zAsc').textContent = zodiacDegree(asc);
    document.getElementById('zDsc').textContent = zodiacDegree(dsc);
    document.getElementById('zAya').textContent = degreeMinute(aya);
    document.getElementById('zTimeLabel').textContent = date.toLocaleString();
    document.getElementById('zOriginLabel').textContent =
      `Origin: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    document.getElementById('zodiacStatus').textContent = 'Sidereal · Lahiri · Great-circle';

    drawStaticGeometry(asc);
    redrawPlanetLines();
    updatePlanetList(placements);
    updateOpacity();
    setVisibility();
  }

  function drawStaticGeometry(asc) {
    const signFeatures = [];
    const nakFeatures = [];
    const houseFeatures = [];
    const dirFeatures = [];
    const labelFeatures = [];

    // Zodiac sign boundaries and labels.
    for (let i = 0; i < 12; i++) {
      const lon = i * 30;
      const bearing = longitudeToBearing(lon, asc);
      signFeatures.push(lineFeature(fullGreatCircle(bearing), {index:i, kind:'sign'}));

      const mid = normalize360(lon + 15);
      const midBearing = longitudeToBearing(mid, asc);
      const pos = destination(state.origin, midBearing, 10500);
      labelFeatures.push(pointFeature(pos, {
        kind:'sign',
        label:`${SIGNS[i][1]} ${SIGNS[i][0]}`
      }));
    }

    // 27 nakshatra boundaries and labels.
    const nakSize = 360 / 27;
    for (let i = 0; i < 27; i++) {
      const lon = i * nakSize;
      const bearing = longitudeToBearing(lon, asc);
      nakFeatures.push(lineFeature(fullGreatCircle(bearing), {index:i, kind:'nak'}));

      const mid = normalize360(lon + nakSize / 2);
      const pos = destination(
        state.origin,
        longitudeToBearing(mid, asc),
        i % 2 ? 7600 : 6900
      );
      labelFeatures.push(pointFeature(pos, {
        kind:'nak',
        label:NAKSHATRAS[i]
      }));
    }

    // Equal 30° houses anchored to ASC.
    for (let i = 0; i < 12; i++) {
      const bearing = normalize360(90 - i * 30);
      houseFeatures.push(lineFeature(fullGreatCircle(bearing), {index:i+1, kind:'house'}));
      const pos = destination(state.origin, normalize360(75 - i * 30), 4300);
      labelFeatures.push(pointFeature(pos, {
        kind:'house',
        label:`H${i+1}`
      }));
    }

    // Physical compass directions.
    for (const [bearing, label] of DIRS) {
      dirFeatures.push(lineFeature(fullGreatCircle(bearing), {kind:'direction'}));
      const pos = destination(state.origin, bearing, 12800);
      labelFeatures.push(pointFeature(pos, {kind:'direction', label}));
    }

    // Explicit ASC/DC labels.
    labelFeatures.push(pointFeature(destination(state.origin, 90, 2500), {
      kind:'house', label:`ASC ${zodiacDegree(asc)}`
    }));
    labelFeatures.push(pointFeature(destination(state.origin, 270, 2500), {
      kind:'house', label:`DSC ${zodiacDegree(normalize360(asc+180))}`
    }));

    setData(ids.signs, signFeatures);
    setData(ids.nak, nakFeatures);
    setData(ids.houses, houseFeatures);
    setData(ids.dirs, dirFeatures);
    setData(ids.labels, labelFeatures);
    setData(ids.origin, [pointFeature(state.origin, {kind:'origin'})]);
  }

  function redrawPlanetLines() {
    if (!state.lastData) return;
    const { asc, placements } = state.lastData;
    const lineFeatures = [];
    const pointFeatures = [];

    for (const p of placements) {
      const bearing = longitudeToBearing(p.lon, asc);
      const highlighted = state.highlightedPlanet === p.name;
      const distance = highlighted ? 15000 : 11800;

      lineFeatures.push(lineFeature(rayCoordinates(bearing, distance), {
        name:p.name,
        highlighted
      }));

      const pos = destination(state.origin, bearing, highlighted ? 9200 : 8500);
      pointFeatures.push(pointFeature(pos, {
        name:p.name,
        highlighted,
        label:`${p.glyph} ${p.name} ${shortDegree(p.lon)}`
      }));
    }

    setData(ids.planetLines, lineFeatures);
    setData(ids.planets, pointFeatures);
  }

  function updatePlanetList(placements) {
    const el = document.getElementById('zPlanetList');
    el.innerHTML = placements.map(p =>
      `<div class="z-planet-item"><b>${p.glyph} ${p.name}</b><span>${zodiacDegree(p.lon)}</span></div>`
    ).join('');
  }

  function computePlanets(date, aya) {
    const A = window.Astronomy;
    const out = [];

    for (const [name, bodyName, glyph] of PLANETS) {
      try {
        const body = A.Body[bodyName];
        const vec = A.GeoVector(body, date, true);
        const ecl = A.Ecliptic(vec);
        out.push({ name, glyph, lon:normalize360(ecl.elon - aya) });
      } catch (err) {
        console.warn('Planet calculation failed', name, err);
      }
    }

    const rahuTropical = meanAscendingNode(date);
    const rahu = normalize360(rahuTropical - aya);
    out.push({ name:'Rahu', glyph:'☊', lon:rahu });
    out.push({ name:'Ketu', glyph:'☋', lon:normalize360(rahu + 180) });

    return out;
  }

  function tropicalAscendant(date, latDeg, lonDeg) {
    const jd = julianDate(date);
    const T = (jd - 2451545.0) / 36525;
    const theta = normalize360(
      280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T*T -
      (T*T*T) / 38710000 +
      lonDeg
    );
    const eps = meanObliquity(T);

    const roots = [];
    let prevLon = 0;
    let prevAlt = eclipticAltitude(0, theta, latDeg, eps);

    for (let lon = 1; lon <= 360; lon += 1) {
      const alt = eclipticAltitude(lon % 360, theta, latDeg, eps);
      if ((prevAlt <= 0 && alt > 0) || (prevAlt >= 0 && alt < 0)) {
        let a = prevLon, b = lon;
        let fa = prevAlt;
        for (let i = 0; i < 42; i++) {
          const m = (a + b) / 2;
          const fm = eclipticAltitude(normalize360(m), theta, latDeg, eps);
          if ((fa <= 0 && fm <= 0) || (fa >= 0 && fm >= 0)) {
            a = m; fa = fm;
          } else {
            b = m;
          }
        }
        const root = normalize360((a+b)/2);
        const az = eclipticAzimuth(root, theta, latDeg, eps);
        roots.push({root, az});
      }
      prevLon = lon;
      prevAlt = alt;
    }

    if (!roots.length) return 0;
    roots.sort((a,b) => angularDistance(a.az, 90) - angularDistance(b.az, 90));
    return roots[0].root;
  }

  function eclipticAltitude(lambdaDeg, lstDeg, latDeg, epsDeg) {
    const lam = rad(lambdaDeg);
    const eps = rad(epsDeg);
    const lat = rad(latDeg);

    const ra = Math.atan2(Math.sin(lam)*Math.cos(eps), Math.cos(lam));
    const dec = Math.asin(Math.sin(eps)*Math.sin(lam));
    const H = rad(normalize180(lstDeg - deg(ra)));

    return deg(Math.asin(
      Math.sin(lat)*Math.sin(dec) +
      Math.cos(lat)*Math.cos(dec)*Math.cos(H)
    ));
  }

  function eclipticAzimuth(lambdaDeg, lstDeg, latDeg, epsDeg) {
    const lam = rad(lambdaDeg);
    const eps = rad(epsDeg);
    const lat = rad(latDeg);

    const ra = Math.atan2(Math.sin(lam)*Math.cos(eps), Math.cos(lam));
    const dec = Math.asin(Math.sin(eps)*Math.sin(lam));
    const H = rad(normalize180(lstDeg - deg(ra)));

    const alt = Math.asin(
      Math.sin(lat)*Math.sin(dec) +
      Math.cos(lat)*Math.cos(dec)*Math.cos(H)
    );

    const y = -Math.cos(dec)*Math.sin(H);
    const x = Math.sin(dec)*Math.cos(lat) -
              Math.cos(dec)*Math.sin(lat)*Math.cos(H);

    return normalize360(deg(Math.atan2(y, x)));
  }

  function lahiriAyanamsa(date) {
    const jd = julianDate(date);
    const T = (jd - 2451545.0) / 36525.0;

    // IAU-2006 style general-precession polynomial anchored to Lahiri J2000.
    const arcsec =
      85885.53 +
      5028.796195 * T +
      1.1054348 * T*T +
      0.00007964 * T*T*T;

    return arcsec / 3600;
  }

  function meanAscendingNode(date) {
    const jd = julianDate(date);
    const T = (jd - 2451545.0) / 36525.0;
    return normalize360(
      125.0445479 -
      1934.1362891*T +
      0.0020754*T*T +
      T*T*T/467441 -
      T*T*T*T/60616000
    );
  }

  function meanObliquity(T) {
    const sec =
      84381.448 -
      46.8150*T -
      0.00059*T*T +
      0.001813*T*T*T;
    return sec / 3600;
  }

  function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function longitudeToBearing(siderealLongitude, asc) {
    // ASC fixed to geographic East; zodiac increases counterclockwise:
    // ASC=E, +90°=N, +180°=W/DSC, +270°=S.
    return normalize360(90 - normalize360(siderealLongitude - asc));
  }

  function fullGreatCircle(bearing) {
    const forward = [];
    for (let d = RAY_MAX_KM; d >= 0; d -= RAY_STEP_KM) {
      forward.push(destination(state.origin, normalize360(bearing+180), d));
    }
    for (let d = RAY_STEP_KM; d <= RAY_MAX_KM; d += RAY_STEP_KM) {
      forward.push(destination(state.origin, bearing, d));
    }
    return splitAntimeridian(forward);
  }

  function rayCoordinates(bearing, maxKm) {
    const coords = [];
    for (let d = 0; d <= maxKm; d += RAY_STEP_KM) {
      coords.push(destination(state.origin, bearing, d));
    }
    return splitAntimeridian(coords);
  }

  function destination(origin, bearingDeg, distanceKm) {
    const δ = distanceKm / EARTH_RADIUS_KM;
    const θ = rad(bearingDeg);
    const φ1 = rad(origin.lat);
    const λ1 = rad(origin.lng);

    const sinφ2 =
      Math.sin(φ1)*Math.cos(δ) +
      Math.cos(φ1)*Math.sin(δ)*Math.cos(θ);
    const φ2 = Math.asin(clamp(sinφ2, -1, 1));

    const y = Math.sin(θ)*Math.sin(δ)*Math.cos(φ1);
    const x = Math.cos(δ) - Math.sin(φ1)*Math.sin(φ2);
    const λ2 = λ1 + Math.atan2(y, x);

    return [normalizeLng(deg(λ2)), deg(φ2)];
  }

  function splitAntimeridian(coords) {
    const segments = [];
    let current = [coords[0]];

    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i-1];
      const cur = coords[i];
      if (Math.abs(cur[0] - prev[0]) > 180) {
        if (current.length > 1) segments.push(current);
        current = [cur];
      } else {
        current.push(cur);
      }
    }
    if (current.length > 1) segments.push(current);

    return segments.length === 1
      ? { type:'LineString', coordinates:segments[0] }
      : { type:'MultiLineString', coordinates:segments };
  }

  function lineFeature(geometry, properties={}) {
    return { type:'Feature', geometry, properties };
  }

  function pointFeature(pos, properties={}) {
    const coords = Array.isArray(pos) ? pos : [pos.lng, pos.lat];
    return { type:'Feature', geometry:{type:'Point', coordinates:coords}, properties };
  }

  function setData(id, features) {
    const source = map.getSource(id);
    if (source) source.setData({type:'FeatureCollection', features});
  }

  function zodiacDegree(lon) {
    const x = normalize360(lon);
    const sign = Math.floor(x / 30);
    const within = x - sign*30;
    const d = Math.floor(within);
    const m = Math.floor((within - d)*60);
    return `${SIGNS[sign][1]} ${d}°${String(m).padStart(2,'0')}′`;
  }

  function shortDegree(lon) {
    const x = normalize360(lon);
    const sign = Math.floor(x / 30);
    const within = x - sign*30;
    return `${SIGNS[sign][1]}${within.toFixed(1)}°`;
  }

  function degreeMinute(x) {
    const d = Math.floor(x);
    const m = Math.floor((x-d)*60);
    const s = Math.round((((x-d)*60)-m)*60);
    return `${d}°${String(m).padStart(2,'0')}′${String(s).padStart(2,'0')}″`;
  }

  function normalize360(x) {
    return ((x % 360) + 360) % 360;
  }

  function normalize180(x) {
    let y = normalize360(x);
    if (y > 180) y -= 360;
    return y;
  }

  function normalizeLng(x) {
    let y = ((x + 180) % 360 + 360) % 360 - 180;
    return y === -180 ? 180 : y;
  }

  function angularDistance(a,b) {
    return Math.abs(normalize180(a-b));
  }

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function clamp(v,a,b) { return Math.max(a, Math.min(b, v)); }

  function showToast(message) {
    const toast = document.getElementById('statusToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  return {
    refresh,
    setOrigin(lng, lat) {
      state.origin = {lng, lat};
      refresh();
    }
  };
}
