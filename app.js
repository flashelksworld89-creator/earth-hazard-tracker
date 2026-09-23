import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.0/dist/maplibre-gl.mjs';

const state = {
  earthquakeFeatures: [],
  gdacsEvents: [],
  markers: [],
  days: 7,
  activeFilter: 'all',
  layerVisibility: {
    earthquakes: true, TC: true, VO: true, FL: true, WF: true, DR: false
  },
  globe: true,
  rotating: true,
  rotationFrame: null
};

const colors = {
  earthquakes: '#fb923c',
  TC: '#c084fc',
  VO: '#fb7185',
  FL: '#60a5fa',
  WF: '#facc15',
  DR: '#d6a86e'
};

const typeNames = {
  earthquakes: 'EARTHQUAKE',
  TC: 'TROPICAL CYCLONE',
  VO: 'VOLCANO',
  FL: 'FLOOD',
  WF: 'WILDFIRE',
  DR: 'DROUGHT'
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [0, 18],
  zoom: 1.45,
  pitch: 0,
  bearing: 0,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.GlobeControl(), 'top-right');

map.on('style.load', () => {
  map.setProjection({ type: 'globe' });
});

map.on('load', () => {
  loadAllData();
  startRotation();
});

map.on('dragstart', () => stopRotation(false));
map.on('mousedown', () => stopRotation(false));
map.on('touchstart', () => stopRotation(false));

map.on('click', async (e) => {
  const target = e.originalEvent?.target;
  if (target?.closest?.('.hazard-marker')) return;
  await showWeatherAt(e.lngLat.lat, e.lngLat.lng);
});

document.querySelectorAll('.layer-toggle').forEach(input => {
  input.addEventListener('change', () => {
    state.layerVisibility[input.dataset.layer] = input.checked;
    renderMarkers();
  });
});

document.querySelectorAll('.timeline-presets button').forEach(btn => {
  btn.addEventListener('click', () => {
    setDays(Number(btn.dataset.days));
  });
});

document.getElementById('timelineRange').addEventListener('input', (e) => {
  setDays(Number(e.target.value), false);
});

document.getElementById('refreshBtn').addEventListener('click', loadAllData);
document.getElementById('clearFilterBtn').addEventListener('click', () => {
  state.activeFilter = 'all';
  renderEventList();
});

document.querySelectorAll('.stat-card').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeFilter = btn.dataset.filter;
    renderEventList();
  });
});

document.getElementById('closeDetail').addEventListener('click', () => {
  document.getElementById('detailPanel').classList.add('hidden');
});

document.getElementById('projectionBtn').addEventListener('click', () => {
  state.globe = !state.globe;
  map.setProjection({ type: state.globe ? 'globe' : 'mercator' });
  document.getElementById('projectionBtn').textContent = state.globe ? 'Switch to flat map' : 'Switch to globe';
});

document.getElementById('rotateBtn').addEventListener('click', () => {
  if (state.rotating) stopRotation(true);
  else startRotation();
});

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  await searchPlace(query);
});

function startRotation() {
  state.rotating = true;
  document.getElementById('rotateBtn').textContent = 'Pause globe rotation';
  cancelAnimationFrame(state.rotationFrame);
  let last = performance.now();

  const tick = (now) => {
    if (!state.rotating) return;
    if (now - last > 40) {
      const c = map.getCenter();
      map.setCenter([c.lng + 0.025, c.lat]);
      last = now;
    }
    state.rotationFrame = requestAnimationFrame(tick);
  };
  state.rotationFrame = requestAnimationFrame(tick);
}

function stopRotation(updateButton = true) {
  state.rotating = false;
  cancelAnimationFrame(state.rotationFrame);
  if (updateButton) document.getElementById('rotateBtn').textContent = 'Resume globe rotation';
  else document.getElementById('rotateBtn').textContent = 'Resume globe rotation';
}

function setDays(days, syncSlider = true) {
  state.days = days;
  document.getElementById('timelineLabel').textContent = `${days} day${days === 1 ? '' : 's'}`;
  if (syncSlider) document.getElementById('timelineRange').value = days;
  document.querySelectorAll('.timeline-presets button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.days) === days);
  });
  renderMarkers();
  renderEventList();
}

async function loadAllData() {
  showToast('Refreshing global hazard data…');
  try {
    const [eqResult, gdacsResult] = await Promise.allSettled([
      fetchUSGS(),
      fetchGDACS()
    ]);

    if (eqResult.status === 'fulfilled') {
      state.earthquakeFeatures = eqResult.value;
    } else {
      console.error(eqResult.reason);
      showToast('USGS data could not be loaded. GDACS may still appear.', 3500);
    }

    if (gdacsResult.status === 'fulfilled') {
      state.gdacsEvents = gdacsResult.value;
    } else {
      console.error(gdacsResult.reason);
      showToast('GDACS data could not be loaded. Earthquakes may still appear.', 3500);
    }

    updateCounts();
    renderMarkers();
    renderEventList();
    document.getElementById('updatedAt').textContent =
      `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } finally {
    setTimeout(() => hideToast(), 900);
  }
}

async function fetchUSGS() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
  const data = await response.json();
  return (data.features || []).filter(f => {
    const [lng, lat] = f.geometry?.coordinates || [];
    return Number.isFinite(lng) && Number.isFinite(lat);
  });
}

async function fetchGDACS() {
  const response = await fetch('/api/gdacs');
  if (!response.ok) throw new Error(`GDACS proxy HTTP ${response.status}`);
  const data = await response.json();
  return normalizeGdacs(data);
}

function normalizeGdacs(data) {
  let features = [];

  if (Array.isArray(data?.features)) features = data.features;
  else if (Array.isArray(data)) features = data;
  else {
    const candidateArrays = Object.values(data || {}).filter(Array.isArray);
    const likely = candidateArrays.find(arr => arr.some(x => x?.geometry || x?.eventtype || x?.eventtypecode));
    if (likely) features = likely;
  }

  return features.map((item, index) => {
    const p = item.properties || item;
    const geometry = item.geometry || p.geometry || null;
    let coords = geometry?.type === 'Point' ? geometry.coordinates : null;

    if (!coords) {
      const lng = numeric(p.longitude ?? p.lon ?? p.lng ?? p.x);
      const lat = numeric(p.latitude ?? p.lat ?? p.y);
      if (Number.isFinite(lng) && Number.isFinite(lat)) coords = [lng, lat];
    }

    const type = String(
      p.eventtype || p.eventtypecode || p.eventType || p.type || ''
    ).toUpperCase().trim();

    if (!['TC','VO','FL','WF','DR'].includes(type) || !coords) return null;

    const dateValue =
      p.fromdate || p.eventdate || p.date || p.datetime || p.startdate || p.created || null;

    return {
      id: p.eventid || p.eventId || p.id || `${type}-${index}`,
      type,
      title: p.name || p.eventname || p.description || p.title || `${typeNames[type]} event`,
      coords: [Number(coords[0]), Number(coords[1])],
      date: dateValue ? new Date(dateValue) : new Date(),
      alert: String(p.alertlevel || p.alertLevel || p.alertscore || '').toUpperCase(),
      severity: p.severity || p.severitytext || p.episodealertscore || '',
      country: p.country || p.countryname || p.iso3 || '',
      url: safeUrl(p.url || p.link || p.htmldescription || '')
    };
  }).filter(Boolean);
}

function numeric(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function safeUrl(v) {
  const text = String(v || '');
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : '';
}

function withinDays(date, days) {
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= days * 86400000;
}

function getVisibleEvents() {
  const eq = state.earthquakeFeatures
    .filter(f => withinDays(f.properties?.time, state.days))
    .map(f => ({
      id: f.id,
      type: 'earthquakes',
      title: f.properties?.title || f.properties?.place || 'Earthquake',
      coords: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
      date: new Date(f.properties?.time),
      alert: f.properties?.alert || '',
      severity: Number.isFinite(f.properties?.mag) ? `M ${Number(f.properties.mag).toFixed(1)}` : '',
      depth: f.geometry.coordinates[2],
      mag: f.properties?.mag,
      tsunami: f.properties?.tsunami,
      url: f.properties?.url || ''
    }));

  const gdacs = state.gdacsEvents.filter(e => withinDays(e.date, state.days));
  return [...eq, ...gdacs];
}

function renderMarkers() {
  state.markers.forEach(m => m.remove());
  state.markers = [];

  const events = getVisibleEvents().filter(event => {
    return state.layerVisibility[event.type] !== false;
  });

  const maxMarkers = 650;
  const prioritized = events
    .sort((a,b) => eventPriority(b) - eventPriority(a))
    .slice(0, maxMarkers);

  prioritized.forEach(event => {
    const el = document.createElement('div');
    const cls = event.type === 'earthquakes' ? 'eq' : event.type;
    el.className = `hazard-marker ${cls}`;
    el.title = event.title;

    const scale = markerScale(event);
    el.style.transform = `scale(${scale})`;

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showEventDetail(event);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(event.coords)
      .addTo(map);

    state.markers.push(marker);
  });
}

function eventPriority(event) {
  if (event.type === 'earthquakes') return (event.mag || 0) * 1000 + event.date.getTime() / 1e12;
  const alert = { RED: 3000, ORANGE: 2000, GREEN: 1000 }[event.alert] || 500;
  return alert + event.date.getTime() / 1e12;
}

function markerScale(event) {
  if (event.type === 'earthquakes') {
    const m = Number(event.mag || 0);
    return Math.max(.55, Math.min(1.65, .35 + m * .18));
  }
  if (event.alert === 'RED') return 1.45;
  if (event.alert === 'ORANGE') return 1.2;
  return 1;
}

function renderEventList() {
  const list = document.getElementById('eventsList');
  let events = getVisibleEvents();

  if (state.activeFilter !== 'all') {
    events = events.filter(e => e.type === state.activeFilter);
    document.getElementById('eventListTitle').textContent = typeNames[state.activeFilter] || 'Filtered events';
  } else {
    document.getElementById('eventListTitle').textContent = 'Recent events';
  }

  events.sort((a,b) => eventPriority(b) - eventPriority(a));
  events = events.slice(0, 80);

  if (!events.length) {
    list.innerHTML = '<div class="loading-card">No events in this time window.</div>';
    return;
  }

  list.innerHTML = '';
  events.forEach(event => {
    const btn = document.createElement('button');
    btn.className = 'event-card';
    btn.innerHTML = `
      <div class="row">
        <span class="type">${escapeHtml(typeNames[event.type] || event.type)}</span>
        <span class="severity">${escapeHtml(event.severity || event.alert || '')}</span>
      </div>
      <strong>${escapeHtml(event.title)}</strong>
      <small>${escapeHtml(formatDate(event.date))}</small>
    `;
    btn.addEventListener('click', () => {
      map.flyTo({ center: event.coords, zoom: Math.max(map.getZoom(), 4.2), duration: 1200 });
      stopRotation();
      showEventDetail(event);
    });
    list.appendChild(btn);
  });
}

function updateCounts() {
  const events = getVisibleEvents();
  const count = type => events.filter(e => e.type === type).length;
  document.getElementById('eqCount').textContent = count('earthquakes');
  document.getElementById('tcCount').textContent = count('TC');
  document.getElementById('voCount').textContent = count('VO');
  document.getElementById('flCount').textContent = count('FL');
}

function showEventDetail(event) {
  const panel = document.getElementById('detailPanel');
  const content = document.getElementById('detailContent');
  const cells = [];

  if (event.type === 'earthquakes') {
    cells.push(['Magnitude', Number.isFinite(event.mag) ? `M ${Number(event.mag).toFixed(1)}` : 'Unknown']);
    cells.push(['Depth', Number.isFinite(Number(event.depth)) ? `${Number(event.depth).toFixed(1)} km` : 'Unknown']);
    cells.push(['Tsunami flag', event.tsunami ? 'Yes' : 'No']);
  } else {
    cells.push(['Alert', event.alert || 'Not listed']);
    if (event.country) cells.push(['Country / region', event.country]);
    if (event.severity) cells.push(['Severity', String(event.severity)]);
  }

  cells.push(['Time / date', formatDate(event.date)]);
  cells.push(['Coordinates', `${event.coords[1].toFixed(2)}, ${event.coords[0].toFixed(2)}`]);

  content.innerHTML = `
    <div class="eyebrow">${escapeHtml(typeNames[event.type] || event.type)}</div>
    <h2>${escapeHtml(event.title)}</h2>
    <div class="detail-grid">
      ${cells.map(([k,v]) => `<div class="detail-cell"><small>${escapeHtml(k)}</small><strong>${escapeHtml(v)}</strong></div>`).join('')}
    </div>
    ${event.url ? `<a class="detail-link" href="${escapeAttr(event.url)}" target="_blank" rel="noopener">Open official source ↗</a>` : ''}
  `;
  panel.classList.remove('hidden');
}

async function showWeatherAt(lat, lng) {
  stopRotation(false);
  showToast('Loading weather for this point…');

  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
      forecast_days: '7',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch'
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
    const w = await response.json();
    const c = w.current || {};

    const panel = document.getElementById('detailPanel');
    document.getElementById('detailContent').innerHTML = `
      <div class="eyebrow">WEATHER AT MAP POINT</div>
      <h2>${lat.toFixed(2)}, ${lng.toFixed(2)}</h2>
      <div class="detail-grid">
        ${weatherCell('Temperature', valueUnit(c.temperature_2m, '°F'))}
        ${weatherCell('Feels like', valueUnit(c.apparent_temperature, '°F'))}
        ${weatherCell('Humidity', valueUnit(c.relative_humidity_2m, '%'))}
        ${weatherCell('Wind', valueUnit(c.wind_speed_10m, ' mph'))}
        ${weatherCell('Wind gusts', valueUnit(c.wind_gusts_10m, ' mph'))}
        ${weatherCell('Pressure', valueUnit(c.pressure_msl, ' hPa'))}
        ${weatherCell('Cloud cover', valueUnit(c.cloud_cover, '%'))}
        ${weatherCell('Precipitation', valueUnit(c.precipitation, ' in'))}
      </div>
      <div style="margin-top:12px;color:#91a8bf;font-size:10px">Click another place on the globe to inspect its current weather.</div>
    `;
    panel.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showToast('Weather data could not be loaded for this point.', 3200);
  } finally {
    setTimeout(hideToast, 800);
  }
}

function weatherCell(label, value) {
  return `<div class="detail-cell"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function valueUnit(v, unit) {
  return (v === null || v === undefined) ? 'Unavailable' : `${v}${unit}`;
}

async function searchPlace(query) {
  showToast(`Searching for ${query}…`);
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    const data = await response.json();
    const place = data.results?.[0];
    if (!place) throw new Error('No place found');

    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: 5.2,
      duration: 1500
    });
    stopRotation();
    await showWeatherAt(place.latitude, place.longitude);
  } catch (err) {
    console.error(err);
    showToast('No matching location was found.', 3000);
  }
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return 'Date unavailable';
  return d.toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

let toastTimer;
function showToast(message, duration = 2200) {
  clearTimeout(toastTimer);
  const toast = document.getElementById('statusToast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  if (duration) toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  document.getElementById('statusToast').classList.add('hidden');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
