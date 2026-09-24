import * as THREE from 'three';
import ThreeGlobe from 'https://esm.sh/three-globe@2.45.0?external=three';
import { TrackballControls } from 'https://esm.sh/three@0.183.2/examples/jsm/controls/TrackballControls.js?external=three';

const SIDEREAL_DAY_MS = 86164.0905 * 1000;
const OBLIQUITY = THREE.MathUtils.degToRad(23.4393);

const SIGNS = [
  ['Aries','♈','#ff5a5f'],['Taurus','♉','#59c36a'],['Gemini','♊','#ffd166'],
  ['Cancer','♋','#8ecae6'],['Leo','♌','#ff9f1c'],['Virgo','♍','#95d5b2'],
  ['Libra','♎','#e0aaff'],['Scorpio','♏','#c9184a'],['Sagittarius','♐','#9b5de5'],
  ['Capricorn','♑','#8d99ae'],['Aquarius','♒','#00b4d8'],['Pisces','♓','#577590']
];

const PLANET_COLORS = {
  Sun:'#ffd166',Moon:'#f8f9fa',Mercury:'#2ec4b6',Venus:'#ff70a6',
  Mars:'#ff3b30',Jupiter:'#f4a261',Saturn:'#adb5bd',Uranus:'#48cae4',
  Neptune:'#4361ee',Pluto:'#9d4edd',Rahu:'#06d6a0',Ketu:'#ef476f'
};

export function initHazardGlobe3D(container, callbacks={}) {
  if (!container) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
  camera.position.set(0, 35, 340);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x020812, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 2.0;
  controls.zoomSpeed = 1.1;
  controls.panSpeed = 0.4;
  controls.noPan = true;
  controls.minDistance = 155;
  controls.maxDistance = 650;

  scene.add(new THREE.AmbientLight(0x8194aa, 1.25));
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  sunLight.position.set(150, 90, 220);
  scene.add(sunLight);

  const earthGroup = new THREE.Group();
  const celestialGroup = new THREE.Group();
  scene.add(earthGroup);
  scene.add(celestialGroup);

  const globe = new ThreeGlobe({ waitForGlobeReady:false })
    .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
    .showAtmosphere(true)
    .atmosphereColor('#70c8ff')
    .atmosphereAltitude(0.16)
    .showGraticules(true)
    .pointsData([])
    .pointLat(d=>d.lat)
    .pointLng(d=>d.lng)
    .pointAltitude(d=>d.altitude ?? 0.012)
    .pointRadius(d=>d.radius ?? .36)
    .pointColor(d=>d.color || '#ffffff')
    .pointsMerge(false)
    .polygonsData([])
    .polygonGeoJsonGeometry(d=>d.geometry)
    .polygonCapColor(d=>d.color || 'rgba(255,255,255,.05)')
    .polygonSideColor(()=> 'rgba(0,0,0,0)')
    .polygonStrokeColor(()=> 'rgba(255,255,255,.08)')
    .polygonAltitude(d=>d.altitude ?? .002);

  earthGroup.add(globe);

  const globeRadius = globe.getGlobeRadius();
  const bandRadius = globeRadius * 1.48;
  const bandTube = globeRadius * 0.028;
  const bandGroup = new THREE.Group();
  celestialGroup.add(bandGroup);

  const planetGroup = new THREE.Group();
  const angleGroup = new THREE.Group();
  celestialGroup.add(planetGroup);
  celestialGroup.add(angleGroup);

  const state = {
    visible:true,
    rotating:true,
    speed:1,
    last:performance.now(),
    astro:null,
    ayanamsa:0,
    events:[],
    risingZones:[],
    rotationEpochY:0,
    rotationEpochRealMs:performance.now(),
    rotationEpochAstroMs:Date.now()
  };

  syncEarthRotation(Date.now(),1);
  buildEclipticBand();

  function buildEclipticBand() {
    bandGroup.clear();
    for (let i=0;i<12;i++) {
      const pts=[];
      for(let j=0;j<=18;j++) {
        const lon=i*30 + j*(30/18);
        pts.push(eclipticPoint(lon, bandRadius));
      }
      const curve=new THREE.CatmullRomCurve3(pts);
      const geometry=new THREE.TubeGeometry(curve, 28, bandTube, 8, false);
      const material=new THREE.MeshPhongMaterial({
        color:SIGNS[i][2],
        transparent:true,
        opacity:.78,
        emissive:new THREE.Color(SIGNS[i][2]),
        emissiveIntensity:.12,
        shininess:35
      });
      bandGroup.add(new THREE.Mesh(geometry,material));

      const label=makeSprite(SIGNS[i][1], SIGNS[i][2], 54, 'bold');
      label.scale.set(12,6,1);
      label.position.copy(eclipticPoint(i*30+15, bandRadius*1.045));
      bandGroup.add(label);
    }
  }

  function eclipticPoint(lonDeg, radius) {
    const physicalLon=lonDeg + (state.ayanamsa||0);
    const a=THREE.MathUtils.degToRad(physicalLon);
    const x=radius*Math.cos(a);
    const z=radius*Math.sin(a);
    const y=z*Math.sin(OBLIQUITY);
    const z2=z*Math.cos(OBLIQUITY);
    return new THREE.Vector3(x,y,z2);
  }

  function makeSprite(text, color='#fff', size=42, weight='600') {
    const canvas=document.createElement('canvas');
    canvas.width=256; canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,256,128);
    ctx.font=`${weight} ${size}px system-ui, Segoe UI Symbol, sans-serif`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.95)';
    ctx.shadowBlur=8;
    ctx.fillStyle=color;
    ctx.fillText(text,128,64);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
    return new THREE.Sprite(material);
  }

  function updateAstro(data) {
    const oldAya=state.ayanamsa;
    state.astro=data;
    state.ayanamsa=Number(data?.ayanamsa)||0;
    if(Math.abs(state.ayanamsa-oldAya)>.0001) buildEclipticBand();
    if(Number.isFinite(Number(data?.timestamp))) syncEarthRotation(Number(data.timestamp),state.speed);
    planetGroup.clear();
    angleGroup.clear();
    if(!data) return;

    (data.placements||[]).forEach((p,index)=>{
      const degree=fullDegree(p.lon);
      const sprite=makeSprite(`${p.glyph} ${degree}`, PLANET_COLORS[p.name]||'#fff', 34, '700');
      const r=bandRadius*(1.10+(index%3)*.035);
      sprite.position.copy(eclipticPoint(p.lon,r));
      sprite.scale.set(20,10,1);
      planetGroup.add(sprite);
    });

    [
      ['ASC',data.asc,'#a7f3d0'],['DSC',data.dsc,'#f9a8d4'],
      ['MC',data.mc,'#fff3b0'],['IC',data.ic,'#c4b5fd']
    ].forEach(([name,lon,color])=>{
      if(!Number.isFinite(Number(lon))) return;
      const marker=makeSprite(`${name} ${shortDegree(Number(lon))}`,color,31,'800');
      marker.position.copy(eclipticPoint(Number(lon),bandRadius*.92));
      marker.scale.set(18,9,1);
      angleGroup.add(marker);
    });
  }

  function setEvents(events=[]) {
    state.events=events;
    const points=events.map(e=>({
      ...e,
      lat:Number(e.coords?.[1]),
      lng:Number(e.coords?.[0]),
      color:hazardColor(e),
      radius:hazardRadius(e),
      altitude:.012
    })).filter(d=>Number.isFinite(d.lat)&&Number.isFinite(d.lng));
    globe.pointsData(points);
  }

  function setRisingZones(features=[]) {
    state.risingZones=features;
    const polys=features.map(f=>({
      geometry:f.geometry,
      signIndex:Number(f.properties?.signIndex)||0,
      active:f.properties?.active!==false,
      color:hexToRgba(SIGNS[Number(f.properties?.signIndex)||0][2],
        f.properties?.active!==false ? .15 : .035),
      altitude:.003
    }));
    globe.polygonsData(polys);
  }

  function hazardColor(e) {
    if(e.type==='earthquakes') return '#ff8a3d';
    return {TC:'#b58cff',VO:'#ff5a5f',FL:'#38bdf8',WF:'#facc15',DR:'#d6a86e'}[e.type]||'#ffffff';
  }

  function hazardRadius(e) {
    if(e.type==='earthquakes') return Math.max(.25,Math.min(1.2,.18+(Number(e.mag)||0)*.13));
    if(e.alert==='RED') return .9;
    if(e.alert==='ORANGE') return .7;
    return .48;
  }

  function setVisible(on) {
    state.visible=!!on;
    container.style.display=state.visible?'block':'none';
  }

  function setRotating(on) { state.rotating=!!on; }
  function setSpeed(speed) {
    const currentAstro=state.rotationEpochAstroMs +
      (performance.now()-state.rotationEpochRealMs)*state.speed;
    state.speed=Math.max(0,Number(speed)||1);
    syncEarthRotation(currentAstro,state.speed);
  }

  function syncEarthRotation(timestamp,speed=state.speed) {
    const gmst=greenwichSiderealDegrees(new Date(timestamp));
    // ThreeGlobe's lon=0 points toward +Z. At GMST=0 the Greenwich meridian
    // faces the sidereal zero direction (+X), requiring a +90° alignment.
    state.rotationEpochY=THREE.MathUtils.degToRad(90-gmst);
    state.rotationEpochRealMs=performance.now();
    state.rotationEpochAstroMs=Number(timestamp);
    state.speed=Math.max(0,Number(speed)||1);
    earthGroup.rotation.y=state.rotationEpochY;
  }

  function greenwichSiderealDegrees(date) {
    const jd=date.getTime()/86400000+2440587.5;
    const T=(jd-2451545.0)/36525;
    return normalize360(
      280.46061837+
      360.98564736629*(jd-2451545.0)+
      .000387933*T*T-
      (T*T*T)/38710000
    );
  }

  function normalize360(x){return ((x%360)+360)%360;}

  function focus(lat,lng,altitude=2.25) {
    const local=globe.getCoords(lat,lng,0);
    const v=new THREE.Vector3(local.x,local.y,local.z).normalize();
    const targetDistance=globeRadius*altitude;
    camera.position.copy(v.multiplyScalar(targetDistance));
    camera.lookAt(0,0,0);
    controls.target.set(0,0,0);
    controls.update();
  }

  function resize() {
    const w=Math.max(1,container.clientWidth);
    const h=Math.max(1,container.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    controls.handleResize?.();
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt=Math.min(250,Math.max(0,now-state.last));
    state.last=now;

    if(state.visible && state.rotating) {
      // Earth rotation is anchored to sidereal time, not an arbitrary animation phase.
      const elapsedReal=now-state.rotationEpochRealMs;
      earthGroup.rotation.y=
        state.rotationEpochY-
        elapsedReal*state.speed*(Math.PI*2/SIDEREAL_DAY_MS);
    }

    controls.update();
    renderer.render(scene,camera);
  }

  function fullDegree(lon) {
    const x=((Number(lon)%360)+360)%360;
    const s=Math.floor(x/30), within=x-s*30;
    const d=Math.floor(within),m=Math.floor((within-d)*60);
    return `${SIGNS[s][1]}${d}°${String(m).padStart(2,'0')}′`;
  }
  function shortDegree(lon) {
    const x=((lon%360)+360)%360;
    const s=Math.floor(x/30),w=x-s*30;
    return `${SIGNS[s][1]}${w.toFixed(1)}°`;
  }
  function hexToRgba(hex,a) {
    const h=hex.replace('#','');
    const n=parseInt(h,16);
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }

  window.addEventListener('resize',resize);
  window.addEventListener('zodiac-astro-state',e=>updateAstro(e.detail));
  window.addEventListener('zodiac-rising-zones',e=>setRisingZones(e.detail?.features||[]));
  window.addEventListener('zodiac-sim-time',e=>{
    const speed=e.detail?.running ? e.detail?.speed : 1;
    const ts=Number(e.detail?.timestamp);
    if(Number.isFinite(ts)) syncEarthRotation(ts,speed);
    else setSpeed(speed);
  });

  resize();
  requestAnimationFrame(animate);

  return { setEvents,setRisingZones,setVisible,setRotating,setSpeed,focus,updateAstro,globe,scene,earthGroup,celestialGroup };
}
