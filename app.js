import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.0/dist/maplibre-gl.mjs';
import { initZodiacCompass } from '/zodiac.js';

const REFRESH = {
  earthquakesMs: 60_000,
  gdacsMs: 5 * 60_000
};

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
  rotationFrame: null,
  autoRefresh: true,
  timers: { earthquakes: null, gdacs: null },
  sourceUpdated: { earthquakes: null, gdacs: null },
  knownEventIds: new Set(),
  newEventIds: new Set(),
  firstLoadComplete: false,
  arEnabled: true,
  arHour: 0,
  arPoints: [],
  arLoaded: false
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

map.on('style.load', () => map.setProjection({ type: 'globe' }));

map.on('load', async () => {
  setupAtmosphericRiverLayer();
  initZodiacCompass(map, maplibregl);
  await Promise.allSettled([loadAllData(), loadAtmosphericRivers(0)]);
  state.firstLoadComplete = true;
  captureKnownEvents();
  startAutoRefresh();
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
  btn.addEventListener('click', () => setDays(Number(btn.dataset.days)));
});

document.getElementById('timelineRange').addEventListener('input', (e) => {
  setDays(Number(e.target.value), false);
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  await loadAllData(true);
});

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

document.getElementById('showNewEventsBtn').addEventListener('click', () => {
  state.activeFilter = 'new';
  renderEventList();
});

document.getElementById('autoRefreshToggle').addEventListener('change', (e) => {
  state.autoRefresh = e.target.checked;
  if (state.autoRefresh) {
    startAutoRefresh();
    showToast('Automatic live refresh enabled.');
  } else {
    stopAutoRefresh();
    showToast('Automatic live refresh paused.');
  }
  updateAutoRefreshText();
});


document.getElementById('arLayerToggle').addEventListener('change', (e) => {
  state.arEnabled = e.target.checked;
  setAtmosphericRiverVisibility();
});

document.getElementById('arRefreshBtn').addEventListener('click', async () => {
  await loadAtmosphericRivers(state.arHour, true);
});

document.querySelectorAll('[data-ar-hour]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const hour = Number(btn.dataset.arHour);
    state.arHour = hour;
    document.querySelectorAll('[data-ar-hour]').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    await loadAtmosphericRivers(hour, true);
  });
});

document.getElementById('closeDetail').addEventListener('click', () => {
  document.getElementById('detailPanel').classList.add('hidden');
});

document.getElementById('projectionBtn').addEventListener('click', () => {
  state.globe = !state.globe;
  map.setProjection({ type: state.globe ? 'globe' : 'mercator' });
  document.getElementById('projectionBtn').textContent =
    state.globe ? 'Switch to flat map' : 'Switch to globe';
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


function setupAtmosphericRiverLayer() {
  if (!map.getSource('atmospheric-rivers')) {
    map.addSource('atmospheric-rivers', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }

  if (!map.getLayer('atmospheric-river-halo')) {
    map.addLayer({
      id: 'atmospheric-river-halo',
      type: 'circle',
      source: 'atmospheric-rivers',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'ivt'],
          250, 16,
          500, 24,
          750, 32,
          1000, 40,
          1250, 50
        ],
        'circle-color': [
          'step', ['get', 'category'],
          '#67e8f9',
          2, '#38bdf8',
          3, '#facc15',
          4, '#fb923c',
          5, '#fb7185'
        ],
        'circle-opacity': 0.15,
        'circle-blur': 0.45
      }
    });
  }

  if (!map.getLayer('atmospheric-river-points')) {
    map.addLayer({
      id: 'atmospheric-river-points',
      type: 'circle',
      source: 'atmospheric-rivers',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'ivt'],
          250, 5,
          500, 7,
          750, 9,
          1000, 11,
          1250, 13
        ],
        'circle-color': [
          'step', ['get', 'category'],
          '#67e8f9',
          2, '#38bdf8',
          3, '#facc15',
          4, '#fb923c',
          5, '#fb7185'
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#e0f2fe',
        'circle-opacity': 0.9
      }
    });
  }

  map.on('click', 'atmospheric-river-points', (e) => {
    const f = e.features?.[0];
    if (!f) return;

    const p = f.properties || {};
    const coords = f.geometry.coordinates.slice();
    const categoryText = Number(p.category) > 0
      ? `Approx. AR ${p.category}`
      : 'AR conditions (<24h / unrated)';

    new maplibregl.Popup({ closeButton: true, maxWidth: '290px' })
      .setLngLat(coords)
      .setHTML(`
        <div class="ar-popup">
          <h3>${categoryText}</h3>
          <p><b>IVT:</b> ${Math.round(Number(p.ivt))} kg m⁻¹ s⁻¹</p>
          <p><b>Intensity:</b> ${escapeHtml(p.intensity || '—')}</p>
          <p><b>Transport direction:</b> ${Math.round(Number(p.direction))}°</p>
          <p><b>Estimated duration:</b> ${Number(p.duration)} h above 250</p>
          <p><b>Event peak IVT:</b> ${Math.round(Number(p.maxIvt))}</p>
          <p><b>Valid:</b> ${escapeHtml(p.validTime || '—')} UTC</p>
          <small>Model-derived screening value on a coarse global grid. Not an official atmospheric-river warning.</small>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'atmospheric-river-points', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'atmospheric-river-points', () => {
    map.getCanvas().style.cursor = '';
  });
}

async function loadAtmosphericRivers(hour = 0, userInitiated = false) {
  const status = document.getElementById('arStatus');
  status.textContent = `Scanning global IVT +${hour}h…`;
  if (userInitiated) showToast('Updating atmospheric river model scan…', 0);

  try {
    const response = await fetch(`/api/atmospheric-rivers?hour=${hour}&ts=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AR scan HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    state.arPoints = data.points || [];
    state.arLoaded = true;

    const features = state.arPoints.map((p, index) => ({
      type: 'Feature',
      id: index,
      geometry: {
        type: 'Point',
        coordinates: [p.lon, p.lat]
      },
      properties: {
        ivt: Number(p.ivt),
        category: Number(p.ar_category),
        intensity: p.intensity,
        direction: Number(p.transport_direction),
        duration: Number(p.duration_hours),
        maxIvt: Number(p.max_ivt_event),
        validTime: p.valid_time,
        shortDuration: Boolean(p.short_duration)
      }
    }));

    const source = map.getSource('atmospheric-rivers');
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features
      });
    }

    setAtmosphericRiverVisibility();

    const rated = state.arPoints.filter(p => Number(p.ar_category) > 0).length;
    const strongest = state.arPoints.reduce((m, p) => Math.max(m, Number(p.ivt) || 0), 0);
    status.textContent = state.arPoints.length
      ? `${state.arPoints.length} threshold points · ${rated} rated · peak ${Math.round(strongest)}`
      : 'No sampled points above IVT 250';

    if (userInitiated) {
      showToast('Atmospheric river scan updated.', 1800);
    }
  } catch (error) {
    console.error(error);
    status.textContent = 'Model scan unavailable';
    if (userInitiated) showToast('Atmospheric river data could not be loaded.', 3200);
  }
}

function setAtmosphericRiverVisibility() {
  const visibility = state.arEnabled ? 'visible' : 'none';
  for (const id of ['atmospheric-river-halo', 'atmospheric-river-points']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (!state.autoRefresh) return;

  state.timers.earthquakes = setInterval(async () => {
    await refreshEarthquakes(true);
  }, REFRESH.earthquakesMs);

  state.timers.gdacs = setInterval(async () => {
    await refreshGDACS(true);
  }, REFRESH.gdacsMs);

  updateAutoRefreshText();
}

function stopAutoRefresh() {
  clearInterval(state.timers.earthquakes);
  clearInterval(state.timers.gdacs);
  state.timers.earthquakes = null;
  state.timers.gdacs = null;
}

function updateAutoRefreshText() {
  const text = document.getElementById('autoRefreshText');
  text.textContent = state.autoRefresh
    ? 'Earthquakes 1 min · Hazards 5 min'
    : 'Paused';
}

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
  if (updateButton) {
    document.getElementById('rotateBtn').textContent = 'Resume globe rotation';
  } else {
    document.getElementById('rotateBtn').textContent = 'Resume globe rotation';
  }
}

function setDays(days, syncSlider = true) {
  state.days = days;
  document.getElementById('timelineLabel').textContent =
    `${days} day${days === 1 ? '' : 's'}`;
  if (syncSlider) document.getElementById('timelineRange').value = days;

  document.querySelectorAll('.timeline-presets button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.days) === days);
  });

  updateCounts();
  renderMarkers();
  renderEventList();
}

async function loadAllData(manual = false) {
  if (manual) showToast('Refreshing all live sources…');

  const [eqResult, gdacsResult] = await Promise.allSettled([
    refreshEarthquakes(false),
    refreshGDACS(false)
  ]);

  if (eqResult.status === 'rejected') console.error(eqResult.reason);
  if (gdacsResult.status === 'rejected') console.error(gdacsResult.reason);

  updateCounts();
  renderMarkers();
  renderEventList();
  updateOverallUpdatedTime();

  if (manual) {
    setTimeout(() => hideToast(), 900);
  }
}

async function refreshEarthquakes(detectNew = true) {
  setSourceStatus('earthquakes', 'loading');

  try {
    const incoming = await fetchUSGS();

    if (detectNew && state.firstLoadComplete) {
      detectNewEvents(
        incoming.map(f => makeEventId('earthquakes', f.id))
      );
    }

    state.earthquakeFeatures = incoming;
    state.sourceUpdated.earthquakes = new Date();
    setSourceStatus('earthquakes', 'ok');

    if (detectNew) {
      updateCounts();
      renderMarkers();
      renderEventList();
      updateNewEventBanner();
      updateOverallUpdatedTime();
    }
  } catch (error) {
    setSourceStatus('earthquakes', 'error');
    console.error(error);
    throw error;
  }
}

async function refreshGDACS(detectNew = true) {
  setSourceStatus('gdacs', 'loading');

  try {
    const incoming = await fetchGDACS();

    if (detectNew && state.firstLoadComplete) {
      detectNewEvents(
        incoming.map(e => makeEventId(e.type, e.id))
      );
    }

    state.gdacsEvents = incoming;
    state.sourceUpdated.gdacs = new Date();
    setSourceStatus('gdacs', 'ok');

    if (detectNew) {
      updateCounts();
      renderMarkers();
      renderEventList();
      updateNewEventBanner();
      updateOverallUpdatedTime();
    }
  } catch (error) {
    setSourceStatus('gdacs', 'error');
    console.error(error);
    throw error;
  }
}

function captureKnownEvents() {
  getVisibleEvents().forEach(event => {
    state.knownEventIds.add(makeEventId(event.type, event.id));
  });
}

function detectNewEvents(eventIds) {
  let found = 0;

  eventIds.forEach(id => {
    if (!state.knownEventIds.has(id)) {
      state.newEventIds.add(id);
      found++;
    }
    state.knownEventIds.add(id);
  });

  if (found > 0) {
    showToast(`${found} new live event${found === 1 ? '' : 's'} detected.`, 3200);
  }
}

function updateNewEventBanner() {
  const banner = document.getElementById('newEventBanner');
  const countEl = document.getElementById('newEventCount');

  if (state.newEventIds.size === 0) {
    banner.classList.add('hidden');
    return;
  }

  countEl.textContent =
    `${state.newEventIds.size} new event${state.newEventIds.size === 1 ? '' : 's'}`;
  banner.classList.remove('hidden');
}

function setSourceStatus(source, status) {
  const dot = document.getElementById(source === 'earthquakes' ? 'usgsStatusDot' : 'gdacsStatusDot');
  const text = document.getElementById(source === 'earthquakes' ? 'usgsUpdated' : 'gdacsUpdated');

  dot.classList.remove('ok', 'error');

  if (status === 'ok') {
    dot.classList.add('ok');
    text.textContent = `Updated ${timeOnly(state.sourceUpdated[source] || new Date())}`;
  } else if (status === 'error') {
    dot.classList.add('error');
    text.textContent = 'Connection error';
  } else {
    text.textContent = 'Updating…';
  }
}

function updateOverallUpdatedTime() {
  const dates = Object.values(state.sourceUpdated).filter(Boolean);
  if (!dates.length) return;
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  document.getElementById('updatedAt').textContent =
    `Latest ${timeOnly(latest)}`;
}

async function fetchUSGS() {
  const url =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);

  const data = await response.json();
  return (data.features || []).filter(f => {
    const [lng, lat] = f.geometry?.coordinates || [];
    return Number.isFinite(lng) && Number.isFinite(lat);
  });
}

async function fetchGDACS() {
  const response = await fetch(`/api/gdacs?ts=${Date.now()}`, { cache: 'no-store' });
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
    const likely = candidateArrays.find(arr =>
      arr.some(x => x?.geometry || x?.eventtype || x?.eventtypecode)
    );
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
      p.fromdate || p.eventdate || p.date || p.datetime ||
      p.startdate || p.created || null;

    return {
      id: p.eventid || p.eventId || p.id || `${type}-${index}`,
      type,
      title:
        p.name || p.eventname || p.description ||
        p.title || `${typeNames[type]} event`,
      coords: [Number(coords[0]), Number(coords[1])],
      date: dateValue ? new Date(dateValue) : new Date(),
      alert: String(
        p.alertlevel || p.alertLevel || p.alertscore || ''
      ).toUpperCase(),
      severity:
        p.severity || p.severitytext || p.episodealertscore || '',
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

function makeEventId(type, id) {
  return `${type}:${id}`;
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
      severity: Number.isFinite(f.properties?.mag)
        ? `M ${Number(f.properties.mag).toFixed(1)}`
        : '',
      depth: f.geometry.coordinates[2],
      mag: f.properties?.mag,
      tsunami: f.properties?.tsunami,
      url: f.properties?.url || ''
    }));

  const gdacs = state.gdacsEvents.filter(e => withinDays(e.date, state.days));

  return [...eq, ...gdacs].map(event => ({
    ...event,
    isNew: state.newEventIds.has(makeEventId(event.type, event.id))
  }));
}

function renderMarkers() {
  state.markers.forEach(m => m.remove());
  state.markers = [];

  const events = getVisibleEvents().filter(event =>
    state.layerVisibility[event.type] !== false
  );

  const maxMarkers = 650;
  const prioritized = events
    .sort((a,b) => eventPriority(b) - eventPriority(a))
    .slice(0, maxMarkers);

  prioritized.forEach(event => {
    const el = document.createElement('div');
    const cls = event.type === 'earthquakes' ? 'eq' : event.type;

    el.className =
      `hazard-marker ${cls}${event.isNew ? ' new-event' : ''}`;
    el.title = event.title;

    const scale = markerScale(event);
    el.style.transform = `scale(${scale})`;

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      acknowledgeEvent(event);
      showEventDetail(event);
    });

    const marker = new maplibregl.Marker({
      element: el,
      anchor: 'center'
    }).setLngLat(event.coords).addTo(map);

    state.markers.push(marker);
  });
}

function eventPriority(event) {
  if (event.type === 'earthquakes') {
    return (event.mag || 0) * 1000 + event.date.getTime() / 1e12;
  }

  const alert =
    { RED: 3000, ORANGE: 2000, GREEN: 1000 }[event.alert] || 500;

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

  if (state.activeFilter === 'new') {
    events = events.filter(e => e.isNew);
    document.getElementById('eventListTitle').textContent = 'Newly detected events';
  } else if (state.activeFilter !== 'all') {
    events = events.filter(e => e.type === state.activeFilter);
    document.getElementById('eventListTitle').textContent =
      typeNames[state.activeFilter] || 'Filtered events';
  } else {
    document.getElementById('eventListTitle').textContent = 'Recent events';
  }

  events.sort((a,b) => eventPriority(b) - eventPriority(a));
  events = events.slice(0, 80);

  if (!events.length) {
    list.innerHTML =
      '<div class="loading-card">No events in this view.</div>';
    return;
  }

  list.innerHTML = '';

  events.forEach(event => {
    const btn = document.createElement('button');
    btn.className =
      `event-card${event.isNew ? ' new-event' : ''}`;

    btn.innerHTML = `
      <div class="row">
        <span class="type">
          ${escapeHtml(typeNames[event.type] || event.type)}
          ${event.isNew ? '<span class="new-badge">NEW</span>' : ''}
        </span>
        <span class="severity">
          ${escapeHtml(event.severity || event.alert || '')}
        </span>
      </div>
      <strong>${escapeHtml(event.title)}</strong>
      <small>${escapeHtml(formatDate(event.date))}</small>
    `;

    btn.addEventListener('click', () => {
      map.flyTo({
        center: event.coords,
        zoom: Math.max(map.getZoom(), 4.2),
        duration: 1200
      });
      stopRotation();
      acknowledgeEvent(event);
      showEventDetail(event);
    });

    list.appendChild(btn);
  });
}

function acknowledgeEvent(event) {
  const id = makeEventId(event.type, event.id);
  state.newEventIds.delete(id);
  updateNewEventBanner();
  renderMarkers();
  renderEventList();
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
    cells.push([
      'Magnitude',
      Number.isFinite(event.mag)
        ? `M ${Number(event.mag).toFixed(1)}`
        : 'Unknown'
    ]);
    cells.push([
      'Depth',
      Number.isFinite(Number(event.depth))
        ? `${Number(event.depth).toFixed(1)} km`
        : 'Unknown'
    ]);
    cells.push(['Tsunami flag', event.tsunami ? 'Yes' : 'No']);
  } else {
    cells.push(['Alert', event.alert || 'Not listed']);
    if (event.country) cells.push(['Country / region', event.country]);
    if (event.severity) cells.push(['Severity', String(event.severity)]);
  }

  cells.push(['Time / date', formatDate(event.date)]);
  cells.push([
    'Coordinates',
    `${event.coords[1].toFixed(2)}, ${event.coords[0].toFixed(2)}`
  ]);

  content.innerHTML = `
    <div class="eyebrow">
      ${escapeHtml(typeNames[event.type] || event.type)}
    </div>
    <h2>${escapeHtml(event.title)}</h2>
    <div class="detail-grid">
      ${cells.map(([k,v]) =>
        `<div class="detail-cell">
          <small>${escapeHtml(k)}</small>
          <strong>${escapeHtml(v)}</strong>
        </div>`
      ).join('')}
    </div>
    ${event.url
      ? `<a class="detail-link"
            href="${escapeAttr(event.url)}"
            target="_blank"
            rel="noopener">
          Open official source ↗
        </a>`
      : ''}
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
      current:
        'temperature_2m,apparent_temperature,relative_humidity_2m,' +
        'precipitation,weather_code,cloud_cover,pressure_msl,' +
        'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,' +
        'precipitation_probability_max,wind_speed_10m_max',
      forecast_days: '7',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch'
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error(`Weather HTTP ${response.status}`);
    }

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
      <div style="margin-top:12px;color:#91a8bf;font-size:10px">
        Click another place on the globe to inspect its current weather.
      </div>
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
  return `
    <div class="detail-cell">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function valueUnit(v, unit) {
  return (v === null || v === undefined)
    ? 'Unavailable'
    : `${v}${unit}`;
}

async function searchPlace(query) {
  showToast(`Searching for ${query}…`);

  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?` +
      `name=${encodeURIComponent(query)}&count=1&language=en&format=json`
    );

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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function timeOnly(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

let toastTimer;

function showToast(message, duration = 2200) {
  clearTimeout(toastTimer);
  const toast = document.getElementById('statusToast');
  toast.textContent = message;
  toast.classList.remove('hidden');

  if (duration) {
    toastTimer = setTimeout(hideToast, duration);
  }
}

function hideToast() {
  document.getElementById('statusToast').classList.add('hidden');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
