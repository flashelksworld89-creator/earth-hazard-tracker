import * as THREE from 'three';
import { OrbitControls } from 'https://esm.sh/three@0.183.2/examples/jsm/controls/OrbitControls.js?external=three';

const A = window.Astronomy;
const OBLIQUITY = THREE.MathUtils.degToRad(23.4393);
const SIDEREAL_DAY_MS = 86164.0905 * 1000;

const SIGNS = [
  ['Aries','♈','#ff5a5f'],['Taurus','♉','#59c36a'],['Gemini','♊','#ffd166'],
  ['Cancer','♋','#8ecae6'],['Leo','♌','#ff9f1c'],['Virgo','♍','#95d5b2'],
  ['Libra','♎','#e0aaff'],['Scorpio','♏','#c9184a'],['Sagittarius','♐','#9b5de5'],
  ['Capricorn','♑','#8d99ae'],['Aquarius','♒','#00b4d8'],['Pisces','♓','#577590']
];

const PLANETS = [
  ['Sun','Sun','☉','#ffd166'],['Moon','Moon','☽','#f8f9fa'],
  ['Mercury','Mercury','☿','#2ec4b6'],['Venus','Venus','♀','#ff70a6'],
  ['Mars','Mars','♂','#ff3b30'],['Jupiter','Jupiter','♃','#f4a261'],
  ['Saturn','Saturn','♄','#adb5bd'],['Uranus','Uranus','♅','#48cae4'],
  ['Neptune','Neptune','♆','#4361ee'],['Pluto','Pluto','♇','#9d4edd']
];

const state = {
  offsetMs: 0,
  playing: false,
  speed: 1,
  epochReal: performance.now(),
  epochAstro: Date.now(),
  rotateEarth: true,
  observer: { lat: 0, lng: 0 },
  lastFrame: performance.now()
};

const sceneEl = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020812);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
camera.position.set(0, 35, 340);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x020812, 1);
sceneEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 190;
controls.maxDistance = 600;

scene.add(new THREE.AmbientLight(0x91a4b8, 1.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(180, 90, 160);
scene.add(keyLight);

const earthGroup = new THREE.Group();
const celestialGroup = new THREE.Group();
scene.add(earthGroup);
scene.add(celestialGroup);

const EARTH_R = 100;
const BAND_R = 145;
const BAND_TUBE = 4.4;

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R, 96, 64),
  new THREE.MeshPhongMaterial({
    color: 0x163451,
    shininess: 14,
    specular: 0x24425c
  })
);
earthGroup.add(earth);

const grid = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_R * 1.002, 24, 16)),
  new THREE.LineBasicMaterial({ color: 0x2e678d, transparent: true, opacity: 0.12 })
);
earthGroup.add(grid);

const axisMat = new THREE.LineBasicMaterial({ color: 0x8fb8cf, transparent: true, opacity: 0.35 });
earthGroup.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-132,0),
    new THREE.Vector3(0,132,0)
  ]),
  axisMat
));

const observerGroup = new THREE.Group();
earthGroup.add(observerGroup);

const observerMarker = new THREE.Mesh(
  new THREE.SphereGeometry(2.7, 18, 18),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
const observerHalo = new THREE.Mesh(
  new THREE.RingGeometry(4.4, 6.5, 40),
  new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
);
observerGroup.add(observerMarker);
observerGroup.add(observerHalo);

const bandGroup = new THREE.Group();
const planetGroup = new THREE.Group();
const angleGroup = new THREE.Group();
celestialGroup.add(bandGroup, planetGroup, angleGroup);

buildBand();

function buildBand() {
  bandGroup.clear();

  for (let i = 0; i < 12; i++) {
    const geom = new THREE.TorusGeometry(
      BAND_R,
      BAND_TUBE,
      10,
      64,
      THREE.MathUtils.degToRad(30)
    );

    const mat = new THREE.MeshPhongMaterial({
      color: SIGNS[i][2],
      emissive: new THREE.Color(SIGNS[i][2]),
      emissiveIntensity: 0.17,
      transparent: true,
      opacity: 0.86,
      depthWrite: true
    });

    const seg = new THREE.Mesh(geom, mat);
    seg.rotation.x = Math.PI / 2;
    seg.rotation.z = OBLIQUITY;
    seg.rotation.y = THREE.MathUtils.degToRad(i * 30);
    bandGroup.add(seg);

    const sprite = makeLabel(SIGNS[i][1], SIGNS[i][2], 58, '700');
    sprite.position.copy(eclipticPoint(i * 30 + 15, BAND_R + 11));
    sprite.scale.set(14, 7, 1);
    bandGroup.add(sprite);
  }
}

function eclipticPoint(lonDeg, radius) {
  const a = THREE.MathUtils.degToRad(lonDeg);
  const x = radius * Math.cos(a);
  const z = radius * Math.sin(a);
  const y = z * Math.sin(OBLIQUITY);
  const z2 = z * Math.cos(OBLIQUITY);
  return new THREE.Vector3(x, y, z2);
}

function makeLabel(text, color='#fff', size=38, weight='600') {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font = `${weight} ${size}px system-ui, Segoe UI Symbol, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.95)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width/2, canvas.height/2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function currentDate() {
  if (state.playing) {
    return new Date(state.epochAstro + (performance.now() - state.epochReal) * state.speed);
  }
  return new Date(Date.now() + state.offsetMs);
}

function refreshAstronomy() {
  try {
    if (!A) throw new Error('Astronomy Engine did not load.');

    const date = currentDate();
    const aya = lahiriAyanamsa(date);
    const { lat, lng } = state.observer;
    const asc = normalize360(tropicalAscendant(date, lat, lng) - aya);
    const dsc = normalize360(asc + 180);
    const mc = normalize360(tropicalMidheaven(date, lng) - aya);
    const ic = normalize360(mc + 180);

    const placements = computePlanets(date, aya);

    updatePlanets(placements);
    updateAngles({ asc, dsc, mc, ic });
    updateReadouts(date, asc, dsc, mc, ic, placements);

    document.getElementById('statusText').textContent =
      `Sidereal · Lahiri · Observer ${state.observer.lat.toFixed(2)}°, ${state.observer.lng.toFixed(2)}°`;
  } catch (err) {
    console.error(err);
    document.getElementById('statusText').textContent = 'Astronomy error';
  }
}

function computePlanets(date, aya) {
  return PLANETS.map(([name, bodyKey, glyph, color]) => {
    const vec = A.GeoVector(A.Body[bodyKey], date, true);
    const ecl = A.Ecliptic(vec);
    return {
      name, glyph, color,
      lon: normalize360(Number(ecl.elon) - aya)
    };
  });
}

function updatePlanets(placements) {
  planetGroup.clear();
  if (!document.getElementById('showPlanets').checked) return;

  placements.forEach((p, index) => {
    const sprite = makeLabel(
      `${p.glyph} ${degreeInSign(p.lon)}`,
      p.color,
      34,
      '700'
    );
    sprite.position.copy(eclipticPoint(p.lon, BAND_R + 18 + (index % 2) * 7));
    sprite.scale.set(24, 10, 1);
    planetGroup.add(sprite);
  });
}

function updateAngles({asc,dsc,mc,ic}) {
  angleGroup.clear();
  if (!document.getElementById('showAngles').checked) return;

  [
    ['ASC',asc,'#a7f3d0'],
    ['DSC',dsc,'#f9a8d4'],
    ['MC',mc,'#fff3b0'],
    ['IC',ic,'#c4b5fd']
  ].forEach(([name, lon, color]) => {
    const sprite = makeLabel(`${name} ${degreeInSign(lon)}`, color, 30, '800');
    sprite.position.copy(eclipticPoint(lon, BAND_R - 15));
    sprite.scale.set(24, 9, 1);
    angleGroup.add(sprite);
  });
}

function updateReadouts(date, asc, dsc, mc, ic, placements) {
  document.getElementById('ascText').textContent = fullZodiac(asc);
  document.getElementById('dscText').textContent = fullZodiac(dsc);
  document.getElementById('mcText').textContent = fullZodiac(mc);
  document.getElementById('icText').textContent = fullZodiac(ic);
  document.getElementById('timeText').textContent = date.toLocaleString();

  document.getElementById('planetList').innerHTML = placements.map(p =>
    `<div><span style="color:${p.color}">${p.glyph}</span><b>${p.name}</b><span>${fullZodiac(p.lon)}</span></div>`
  ).join('');
}

function updateObserverMarker() {
  const { lat, lng } = state.observer;
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 90);
  const r = EARTH_R * 1.035;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);

  observerGroup.position.set(x, y, z);
  observerGroup.lookAt(0,0,0);
  observerGroup.rotateY(Math.PI);
}

function applyObserver(lat, lng) {
  const nextLat = Math.max(-89.9, Math.min(89.9, Number(lat)));
  let nextLng = Number(lng);
  if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return false;
  nextLng = ((nextLng + 180) % 360 + 360) % 360 - 180;

  state.observer = { lat: nextLat, lng: nextLng };
  document.getElementById('latitudeInput').value = nextLat.toFixed(4);
  document.getElementById('longitudeInput').value = nextLng.toFixed(4);
  document.getElementById('observerStatus').textContent =
    `${nextLat.toFixed(4)}°, ${nextLng.toFixed(4)}°`;

  updateObserverMarker();
  refreshAstronomy();
  return true;
}

function syncEarthToSiderealTime(date) {
  const gmst = greenwichSiderealDegrees(date);
  earthGroup.rotation.y = THREE.MathUtils.degToRad(90 - gmst);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(100, Math.max(0, now - state.lastFrame));
  state.lastFrame = now;

  if (state.rotateEarth) {
    const speed = state.playing ? state.speed : 1;
    earthGroup.rotation.y -= dt * speed * (Math.PI * 2 / SIDEREAL_DAY_MS);
  }

  controls.update();
  renderer.render(scene, camera);

  if (state.playing) refreshAstronomyThrottled();
}

let lastAstroRefresh = 0;
function refreshAstronomyThrottled() {
  const now = performance.now();
  if (now - lastAstroRefresh < 500) return;
  lastAstroRefresh = now;
  refreshAstronomy();
}

function resize() {
  const w = Math.max(1, sceneEl.clientWidth);
  const h = Math.max(1, sceneEl.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function resetView() {
  camera.position.set(0, 35, 340);
  controls.target.set(0,0,0);
  controls.update();
}

document.querySelectorAll('[data-minutes]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.playing = false;
    document.getElementById('playBtn').textContent = '▶ Play';
    state.offsetMs += Number(btn.dataset.minutes) * 60000;
    syncEarthToSiderealTime(currentDate());
    refreshAstronomy();
  });
});

document.getElementById('nowBtn').addEventListener('click', () => {
  state.playing = false;
  state.offsetMs = 0;
  document.getElementById('playBtn').textContent = '▶ Play';
  syncEarthToSiderealTime(currentDate());
  refreshAstronomy();
});

document.getElementById('playBtn').addEventListener('click', () => {
  if (!state.playing) {
    state.epochAstro = currentDate().getTime();
    state.epochReal = performance.now();
    state.playing = true;
    document.getElementById('playBtn').textContent = '⏸ Pause';
  } else {
    state.offsetMs = currentDate().getTime() - Date.now();
    state.playing = false;
    document.getElementById('playBtn').textContent = '▶ Play';
  }
});

document.getElementById('speedSelect').addEventListener('change', e => {
  const astroNow = currentDate().getTime();
  state.speed = Math.max(1, Number(e.target.value) || 1);
  if (state.playing) {
    state.epochAstro = astroNow;
    state.epochReal = performance.now();
  }
});

document.getElementById('rotateEarth').addEventListener('change', e => {
  state.rotateEarth = e.target.checked;
});

document.getElementById('showPlanets').addEventListener('change', refreshAstronomy);
document.getElementById('showAngles').addEventListener('change', refreshAstronomy);
document.getElementById('showSigns').addEventListener('change', e => {
  bandGroup.visible = e.target.checked;
});

document.getElementById('applyLocationBtn').addEventListener('click', () => {
  const lat = document.getElementById('latitudeInput').value;
  const lng = document.getElementById('longitudeInput').value;
  applyObserver(lat, lng);
});

document.getElementById('useLocationBtn').addEventListener('click', () => {
  const status = document.getElementById('observerStatus');
  if (!navigator.geolocation) {
    status.textContent = 'Geolocation unavailable';
    return;
  }
  status.textContent = 'Requesting location…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      applyObserver(pos.coords.latitude, pos.coords.longitude);
      status.textContent =
        `${state.observer.lat.toFixed(4)}°, ${state.observer.lng.toFixed(4)}°`;
    },
    err => {
      console.error(err);
      status.textContent = 'Location permission denied';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});

document.getElementById('resetViewBtn').addEventListener('click', resetView);

window.addEventListener('resize', resize);

function lahiriAyanamsa(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const arcsec =
    85885.53 +
    5028.796195 * T +
    1.1054348 * T*T +
    .00007964 * T*T*T;
  return arcsec / 3600;
}

function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function localSiderealDegrees(date, lonDeg) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  return normalize360(
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    .000387933 * T*T -
    (T*T*T) / 38710000 +
    lonDeg
  );
}

function meanObliquity(T) {
  return 23.43929111 -
    (46.8150 * T + 0.00059 * T*T - 0.001813 * T*T*T) / 3600;
}

function tropicalMidheaven(date, lonDeg) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const theta = THREE.MathUtils.degToRad(localSiderealDegrees(date, lonDeg));
  const eps = THREE.MathUtils.degToRad(meanObliquity(T));
  return normalize360(THREE.MathUtils.radToDeg(
    Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(eps))
  ));
}

function tropicalAscendant(date, latDeg, lonDeg) {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  const theta = THREE.MathUtils.degToRad(localSiderealDegrees(date, lonDeg));
  const phi = THREE.MathUtils.degToRad(latDeg);
  const eps = THREE.MathUtils.degToRad(meanObliquity(T));

  return normalize360(
    THREE.MathUtils.radToDeg(
      Math.atan2(
        -Math.cos(theta),
        Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)
      )
    ) + 180
  );
}

function greenwichSiderealDegrees(date) {
  return localSiderealDegrees(date, 0);
}

function normalize360(x) {
  return ((x % 360) + 360) % 360;
}

function fullZodiac(lon) {
  const x = normalize360(lon);
  const i = Math.floor(x / 30);
  const within = x - i * 30;
  const d = Math.floor(within);
  const m = Math.floor((within - d) * 60);
  return `${SIGNS[i][1]} ${SIGNS[i][0]} ${d}°${String(m).padStart(2,'0')}′`;
}

function degreeInSign(lon) {
  const x = normalize360(lon);
  const within = x % 30;
  return `${Math.floor(within)}°`;
}

resize();
resetView();
syncEarthToSiderealTime(currentDate());
updateObserverMarker();
refreshAstronomy();
requestAnimationFrame(animate);
