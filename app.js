import * as THREE from 'three';
import { OrbitControls } from 'https://esm.sh/three@0.183.2/examples/jsm/controls/OrbitControls.js?external=three';

const A = window.Astronomy;
const SIDEREAL_DAY_MS = 86164.0905 * 1000;

const SIGNS = [
  ['Aries','♈','#ff5a5f'],['Taurus','♉','#59c36a'],['Gemini','♊','#ffd166'],
  ['Cancer','♋','#8ecae6'],['Leo','♌','#ff9f1c'],['Virgo','♍','#95d5b2'],
  ['Libra','♎','#e0aaff'],['Scorpio','♏','#c9184a'],['Sagittarius','♐','#9b5de5'],
  ['Capricorn','♑','#8d99ae'],['Aquarius','♒','#00b4d8'],['Pisces','♓','#577590']
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
  'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
  'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha',
  'Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada',
  'Uttara Bhadrapada','Revati'
];

const PLANETS = [
  ['Sun','Sun','☉','#ffd166'],['Moon','Moon','☽','#f8f9fa'],
  ['Mercury','Mercury','☿','#2ec4b6'],['Venus','Venus','♀','#ff70a6'],
  ['Mars','Mars','♂','#ff3b30'],['Jupiter','Jupiter','♃','#f4a261'],
  ['Saturn','Saturn','♄','#adb5bd'],['Uranus','Uranus','♅','#48cae4'],
  ['Neptune','Neptune','♆','#4361ee'],['Pluto','Pluto','♇','#9d4edd']
];

const NAK_SIZE = 360 / 27;
const EARTH_R = 100;
const SKIN_R = 102.2;
const BAND_R = 145;
const BAND_TUBE = 4.2;

const state = {
  offsetMs: 0,
  playing: false,
  speed: 1,
  epochReal: performance.now(),
  epochAstro: Date.now(),
  rotateEarth: true,
  frozenEarthRotation: 0,
  observer: { lat: 0, lng: 0 },
  lastFrame: performance.now(),
  currentAya: 0,
  currentObliquity: THREE.MathUtils.degToRad(23.4393),
  zoneCenters: Array(27).fill(null),
  lastSkinUpdate: 0,
  lastAstroRefresh: 0,
  placements: []
};

const sceneEl = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020812);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2500);
camera.position.set(0, 35, 340);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x020812,1);
sceneEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 185;
controls.maxDistance = 650;

scene.add(new THREE.AmbientLight(0x8ba0b5, 1.35));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
keyLight.position.set(170, 90, 150);
scene.add(keyLight);

const earthGroup = new THREE.Group();
const celestialGroup = new THREE.Group();
scene.add(earthGroup);
scene.add(celestialGroup);

const earthMaterial = new THREE.MeshPhongMaterial({
  color:0xffffff,
  shininess:14,
  specular:0x25445d
});
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R, 128, 64),
  earthMaterial
);
earthGroup.add(earth);

const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-blue-marble.jpg',
  tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    earthMaterial.map = tex;
    earthMaterial.needsUpdate = true;
    document.getElementById('statusText').textContent = 'Earth texture loaded · calculating sky';
  },
  undefined,
  err => {
    console.error('Earth texture failed',err);
    earthMaterial.color.set(0x163451);
  }
);

const equator = makeGeoLine(
  Array.from({length:181},(_,i)=>({lat:0,lng:-180+i*2})),
  0x7dd3fc,.56,EARTH_R*1.008
);
earthGroup.add(equator);

const primeMeridian = makeGeoLine(
  Array.from({length:181},(_,i)=>({lat:-90+i,lng:0})),
  0xffffff,.62,EARTH_R*1.01
);
earthGroup.add(primeMeridian);

const axisLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-132,0),new THREE.Vector3(0,132,0)
  ]),
  new THREE.LineBasicMaterial({color:0x8fb8cf,transparent:true,opacity:.35})
);
earthGroup.add(axisLine);

const observerGroup = new THREE.Group();
earthGroup.add(observerGroup);
const observerMarker = new THREE.Mesh(
  new THREE.SphereGeometry(2.5,18,18),
  new THREE.MeshBasicMaterial({color:0xffffff})
);
const observerHalo = new THREE.Mesh(
  new THREE.RingGeometry(4.2,6.4,40),
  new THREE.MeshBasicMaterial({
    color:0x67e8f9,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false
  })
);
observerGroup.add(observerMarker,observerHalo);

const starGroup = new THREE.Group();
celestialGroup.add(starGroup);
buildFixedStars();

const bandGroup = new THREE.Group();
const planetGroup = new THREE.Group();
const angleGroup = new THREE.Group();
celestialGroup.add(bandGroup,planetGroup,angleGroup);

const skinGroup = new THREE.Group();
const skinLabelGroup = new THREE.Group();
const projectedPlanetGroup = new THREE.Group();
earthGroup.add(skinGroup,skinLabelGroup,projectedPlanetGroup);

buildNakshatraKey();
refreshAstronomy(true);
resize();
resetView();
updateObserverMarker();
requestAnimationFrame(animate);

function currentDate(){
  if(state.playing){
    return new Date(state.epochAstro+(performance.now()-state.epochReal)*state.speed);
  }
  return new Date(Date.now()+state.offsetMs);
}

function refreshAstronomy(forceSkin=false){
  try{
    if(!A) throw new Error('Astronomy Engine did not load.');

    const date=currentDate();
    const aya=lahiriAyanamsa(date);
    const obl=THREE.MathUtils.degToRad(meanObliquityFromDate(date));
    const {lat,lng}=state.observer;

    state.currentAya=aya;
    state.currentObliquity=obl;

    const asc=normalize360(tropicalAscendant(date,lat,lng)-aya);
    const dsc=normalize360(asc+180);
    const mc=normalize360(tropicalMidheaven(date,lng)-aya);
    const ic=normalize360(mc+180);
    const placements=computePlanets(date,aya);
    state.placements=placements;

    buildEclipticBand();
    updatePlanets(placements);
    updateAngles({asc,dsc,mc,ic});
    updateReadouts(date,asc,dsc,mc,ic,placements);

    const skinDue=forceSkin || performance.now()-state.lastSkinUpdate>900;
    if(skinDue){
      updateNakshatraSkin(date,aya);
      state.lastSkinUpdate=performance.now();
    }

    document.getElementById('statusText').textContent=
      `Sidereal · Lahiri · Observer ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  }catch(err){
    console.error(err);
    document.getElementById('statusText').textContent='Astronomy error';
  }
}

function buildEclipticBand(){
  bandGroup.clear();
  for(let i=0;i<12;i++){
    const points=[];
    for(let j=0;j<=20;j++){
      const lon=i*30+j*1.5;
      points.push(eclipticPoint(lon,BAND_R));
    }
    const curve=new THREE.CatmullRomCurve3(points);
    const geometry=new THREE.TubeGeometry(curve,32,BAND_TUBE,8,false);
    const color=SIGNS[i][2];
    const material=new THREE.MeshPhongMaterial({
      color,
      emissive:new THREE.Color(color),
      emissiveIntensity:.17,
      transparent:true,
      opacity:.82,
      depthWrite:true
    });
    bandGroup.add(new THREE.Mesh(geometry,material));

    const label=makeLabel(SIGNS[i][1],color,58,'700');
    label.position.copy(eclipticPoint(i*30+15,BAND_R+11));
    label.scale.set(14,7,1);
    bandGroup.add(label);
  }
  bandGroup.visible=document.getElementById('showSigns').checked;
}

function buildFixedStars(){
  const count=1300;
  const pos=new Float32Array(count*3);
  let seed=123456789;
  const rand=()=>{
    seed=(1664525*seed+1013904223)>>>0;
    return seed/4294967296;
  };
  for(let i=0;i<count;i++){
    const u=rand()*2-1;
    const t=rand()*Math.PI*2;
    const r=700+rand()*120;
    const s=Math.sqrt(1-u*u);
    pos[i*3]=r*s*Math.cos(t);
    pos[i*3+1]=r*u;
    pos[i*3+2]=r*s*Math.sin(t);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({
    color:0xdcecff,size:1.35,sizeAttenuation:false,transparent:true,opacity:.72
  });
  starGroup.add(new THREE.Points(g,m));
}

function computePlanets(date,aya){
  const list=PLANETS.map(([name,bodyKey,glyph,color])=>{
    const vec=A.GeoVector(A.Body[bodyKey],date,true);
    const ecl=A.Ecliptic(vec);
    return {name,glyph,color,lon:normalize360(Number(ecl.elon)-aya)};
  });

  const rahu=normalize360(meanNodeTropicalLongitude(date)-aya);
  list.push(
    {name:'Rahu',glyph:'☊',color:'#06d6a0',lon:rahu},
    {name:'Ketu',glyph:'☋',color:'#ef476f',lon:normalize360(rahu+180)}
  );
  return list;
}

function updatePlanets(placements){
  planetGroup.clear();
  if(!document.getElementById('showPlanets').checked) return;

  placements.forEach((p,index)=>{
    const sprite=makeLabel(
      `${p.glyph} ${degreeInSign(p.lon)}`,
      p.color,34,'700'
    );
    sprite.position.copy(eclipticPoint(p.lon,BAND_R+18+(index%3)*7));
    sprite.scale.set(24,10,1);
    planetGroup.add(sprite);
  });
}

function updateAngles({asc,dsc,mc,ic}){
  angleGroup.clear();
  if(!document.getElementById('showAngles').checked) return;

  [
    ['ASC',asc,'#a7f3d0'],['DSC',dsc,'#f9a8d4'],
    ['MC',mc,'#fff3b0'],['IC',ic,'#c4b5fd']
  ].forEach(([name,lon,color])=>{
    const sprite=makeLabel(`${name} ${degreeInSign(lon)}`,color,30,'800');
    sprite.position.copy(eclipticPoint(lon,BAND_R-16));
    sprite.scale.set(24,9,1);
    angleGroup.add(sprite);
  });
}

function updateNakshatraSkin(date,aya){
  skinGroup.clear();
  skinLabelGroup.clear();
  projectedPlanetGroup.clear();
  state.zoneCenters=Array(27).fill(null);

  const verts=[];
  const colors=[];
  const stepLat=10;
  const stepLng=10;
  const colorCache=NAKSHATRAS.map((_,i)=>nakColor(i));

  for(let lat=-90;lat<90;lat+=stepLat){
    const lat2=Math.min(90,lat+stepLat);
    const centerLat=(lat+lat2)/2;

    for(let lng=-180;lng<180;lng+=stepLng){
      const lng2=lng+stepLng;
      const centerLng=lng+stepLng/2;
      const asc=normalize360(tropicalAscendant(date,centerLat,centerLng)-aya);
      const ni=Math.min(26,Math.floor(asc/NAK_SIZE));
      const c=colorCache[ni];

      const p00=geoPoint(lat,lng,SKIN_R);
      const p10=geoPoint(lat2,lng,SKIN_R);
      const p11=geoPoint(lat2,lng2,SKIN_R);
      const p01=geoPoint(lat,lng2,SKIN_R);

      pushTri(p00,p10,p11,c);
      pushTri(p00,p11,p01,c);

      const old=state.zoneCenters[ni];
      if(!old || Math.abs(centerLat)<Math.abs(old.lat)){
        state.zoneCenters[ni]={lat:centerLat,lng:centerLng};
      }
    }
  }

  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geom.computeVertexNormals();

  const mat=new THREE.MeshBasicMaterial({
    vertexColors:true,
    transparent:true,
    opacity:.22,
    side:THREE.DoubleSide,
    depthWrite:false
  });

  const mesh=new THREE.Mesh(geom,mat);
  skinGroup.add(mesh);
  skinGroup.visible=document.getElementById('showNakSkin').checked;

  if(document.getElementById('showNakLabels').checked){
    state.zoneCenters.forEach((center,i)=>{
      if(!center) return;
      const sprite=makeLabel(NAKSHATRAS[i],colorToCss(colorCache[i]),24,'700');
      sprite.position.copy(geoPoint(center.lat,center.lng,EARTH_R*1.075));
      sprite.scale.set(26,8,1);
      skinLabelGroup.add(sprite);
    });
  }

  if(document.getElementById('showProjectedPlanets').checked){
    const occupancy=new Map();
    state.placements.forEach(p=>{
      const ni=Math.min(26,Math.floor(normalize360(p.lon)/NAK_SIZE));
      const center=state.zoneCenters[ni];
      if(!center) return;
      const slot=occupancy.get(ni)||0;
      occupancy.set(ni,slot+1);
      const lat=Math.max(-78,Math.min(78,center.lat+(slot-1)*4.5));
      const sprite=makeLabel(`${p.glyph} ${p.name}`,p.color,25,'800');
      sprite.position.copy(geoPoint(lat,center.lng,EARTH_R*1.105));
      sprite.scale.set(22,8,1);
      projectedPlanetGroup.add(sprite);
    });
  }

  function pushTri(a,b,c,col){
    [a,b,c].forEach(p=>{
      verts.push(p.x,p.y,p.z);
      colors.push(col.r,col.g,col.b);
    });
  }
}

function buildNakshatraKey(){
  const key=document.getElementById('nakshatraKey');
  key.innerHTML=NAKSHATRAS.map((name,i)=>{
    const c=colorToCss(nakColor(i));
    return `<span><i style="background:${c}"></i>${name}</span>`;
  }).join('');
}

function nakColor(index){
  return new THREE.Color().setHSL(index/27,.72,.55);
}

function colorToCss(c){
  return '#'+c.getHexString();
}

function eclipticPoint(siderealLonDeg,radius){
  const tropicalLon=siderealLonDeg+state.currentAya;
  const a=THREE.MathUtils.degToRad(tropicalLon);
  const eps=state.currentObliquity;
  const x=radius*Math.cos(a);
  const equatorialZ=radius*Math.sin(a)*Math.cos(eps);
  const northY=radius*Math.sin(a)*Math.sin(eps);
  return new THREE.Vector3(x,northY,equatorialZ);
}

function geoPoint(latDeg,lngDeg,radius){
  const lat=THREE.MathUtils.degToRad(latDeg);
  const lng=THREE.MathUtils.degToRad(lngDeg);
  const cl=Math.cos(lat);
  return new THREE.Vector3(
    radius*cl*Math.cos(lng),
    radius*Math.sin(lat),
    radius*cl*Math.sin(lng)
  );
}

function makeGeoLine(points,color,opacity,radius){
  const verts=points.map(p=>geoPoint(p.lat,p.lng,radius));
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(verts),
    new THREE.LineBasicMaterial({color,transparent:true,opacity})
  );
}

function makeLabel(text,color='#fff',size=38,weight='600'){
  const canvas=document.createElement('canvas');
  canvas.width=420;
  canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font=`${weight} ${size}px system-ui, Segoe UI Symbol, sans-serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.shadowColor='rgba(0,0,0,.98)';
  ctx.shadowBlur=9;
  ctx.fillStyle=color;
  ctx.fillText(text,canvas.width/2,canvas.height/2);

  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;

  return new THREE.Sprite(new THREE.SpriteMaterial({
    map:texture,transparent:true,depthTest:false,depthWrite:false
  }));
}

function updateObserverMarker(){
  observerGroup.position.copy(
    geoPoint(state.observer.lat,state.observer.lng,EARTH_R*1.035)
  );
  observerGroup.lookAt(0,0,0);
  observerGroup.rotateY(Math.PI);
}

function applyObserver(lat,lng){
  const nextLat=Number(lat);
  const rawLng=Number(lng);
  if(!Number.isFinite(nextLat)||!Number.isFinite(rawLng)) return false;

  const clampedLat=Math.max(-89.9,Math.min(89.9,nextLat));
  const nextLng=((rawLng+180)%360+360)%360-180;
  state.observer={lat:clampedLat,lng:nextLng};

  document.getElementById('latitudeInput').value=clampedLat.toFixed(4);
  document.getElementById('longitudeInput').value=nextLng.toFixed(4);
  document.getElementById('observerStatus').textContent=
    `${clampedLat.toFixed(4)}°, ${nextLng.toFixed(4)}°`;

  updateObserverMarker();
  refreshAstronomy(true);
  return true;
}

function syncEarthToSiderealTime(date){
  const gmst=greenwichSiderealDegrees(date);
  earthGroup.rotation.y=THREE.MathUtils.degToRad(-gmst);
}

function animate(now){
  requestAnimationFrame(animate);
  state.lastFrame=now;

  if(state.rotateEarth){
    syncEarthToSiderealTime(currentDate());
  }else{
    earthGroup.rotation.y=state.frozenEarthRotation;
  }

  controls.update();
  renderer.render(scene,camera);

  const refreshEvery=state.playing ? 350 : 1200;
  if(now-state.lastAstroRefresh>refreshEvery){
    state.lastAstroRefresh=now;
    refreshAstronomy(false);
  }
}

function updateReadouts(date,asc,dsc,mc,ic,placements){
  document.getElementById('ascText').textContent=fullZodiac(asc);
  document.getElementById('dscText').textContent=fullZodiac(dsc);
  document.getElementById('mcText').textContent=fullZodiac(mc);
  document.getElementById('icText').textContent=fullZodiac(ic);
  document.getElementById('timeText').textContent=date.toLocaleString();

  document.getElementById('planetList').innerHTML=placements.map(p=>{
    const ni=Math.min(26,Math.floor(normalize360(p.lon)/NAK_SIZE));
    return `<div>
      <span style="color:${p.color}">${p.glyph}</span>
      <b>${p.name}</b>
      <span>${fullZodiac(p.lon)} · ${NAKSHATRAS[ni]}</span>
    </div>`;
  }).join('');
}

function resize(){
  const w=Math.max(1,sceneEl.clientWidth);
  const h=Math.max(1,sceneEl.clientHeight);
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}

function resetView(){
  camera.position.set(0,35,340);
  controls.target.set(0,0,0);
  controls.update();
}

document.querySelectorAll('[data-minutes]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(state.playing){
      state.offsetMs=currentDate().getTime()-Date.now();
      state.playing=false;
      document.getElementById('playBtn').textContent='▶ Play';
    }
    state.offsetMs+=Number(btn.dataset.minutes)*60000;
    syncEarthToSiderealTime(currentDate());
    refreshAstronomy(true);
  });
});

document.getElementById('nowBtn').addEventListener('click',()=>{
  state.playing=false;
  state.offsetMs=0;
  document.getElementById('playBtn').textContent='▶ Play';
  syncEarthToSiderealTime(currentDate());
  refreshAstronomy(true);
});

document.getElementById('playBtn').addEventListener('click',()=>{
  if(!state.playing){
    state.epochAstro=currentDate().getTime();
    state.epochReal=performance.now();
    state.playing=true;
    document.getElementById('playBtn').textContent='⏸ Pause';
  }else{
    state.offsetMs=currentDate().getTime()-Date.now();
    state.playing=false;
    document.getElementById('playBtn').textContent='▶ Play';
  }
});

document.getElementById('speedSelect').addEventListener('change',e=>{
  const astroNow=currentDate().getTime();
  state.speed=Math.max(1,Number(e.target.value)||1);
  if(state.playing){
    state.epochAstro=astroNow;
    state.epochReal=performance.now();
  }
});

document.getElementById('rotateEarth').addEventListener('change',e=>{
  state.rotateEarth=e.target.checked;
  if(!state.rotateEarth) state.frozenEarthRotation=earthGroup.rotation.y;
});

document.getElementById('showPlanets').addEventListener('change',()=>refreshAstronomy(false));
document.getElementById('showAngles').addEventListener('change',()=>refreshAstronomy(false));
document.getElementById('showSigns').addEventListener('change',e=>{bandGroup.visible=e.target.checked;});
document.getElementById('showStars').addEventListener('change',e=>{starGroup.visible=e.target.checked;});
document.getElementById('showNakSkin').addEventListener('change',e=>{skinGroup.visible=e.target.checked;});
document.getElementById('showNakLabels').addEventListener('change',()=>refreshAstronomy(true));
document.getElementById('showProjectedPlanets').addEventListener('change',()=>refreshAstronomy(true));

document.getElementById('applyLocationBtn').addEventListener('click',()=>{
  applyObserver(
    document.getElementById('latitudeInput').value,
    document.getElementById('longitudeInput').value
  );
});

document.getElementById('useLocationBtn').addEventListener('click',()=>{
  const status=document.getElementById('observerStatus');
  if(!navigator.geolocation){
    status.textContent='Geolocation unavailable';
    return;
  }
  status.textContent='Requesting location…';
  navigator.geolocation.getCurrentPosition(
    pos=>applyObserver(pos.coords.latitude,pos.coords.longitude),
    err=>{
      console.error(err);
      status.textContent='Location permission denied';
    },
    {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
  );
});

document.getElementById('resetViewBtn').addEventListener('click',resetView);
window.addEventListener('resize',resize);

function lahiriAyanamsa(date){
  const jd=julianDate(date);
  const T=(jd-2451545.0)/36525;
  const arcsec=85885.53+5028.796195*T+1.1054348*T*T+.00007964*T*T*T;
  return arcsec/3600;
}

function julianDate(date){
  return date.getTime()/86400000+2440587.5;
}

function localSiderealDegrees(date,lonDeg){
  const jd=julianDate(date);
  const T=(jd-2451545.0)/36525;
  return normalize360(
    280.46061837+
    360.98564736629*(jd-2451545.0)+
    .000387933*T*T-
    (T*T*T)/38710000+
    lonDeg
  );
}

function meanObliquityFromDate(date){
  const T=(julianDate(date)-2451545.0)/36525;
  return 23.43929111-(46.8150*T+.00059*T*T-.001813*T*T*T)/3600;
}

function tropicalMidheaven(date,lonDeg){
  const theta=THREE.MathUtils.degToRad(localSiderealDegrees(date,lonDeg));
  const eps=THREE.MathUtils.degToRad(meanObliquityFromDate(date));
  return normalize360(THREE.MathUtils.radToDeg(
    Math.atan2(Math.sin(theta),Math.cos(theta)*Math.cos(eps))
  ));
}

function tropicalAscendant(date,latDeg,lonDeg){
  const theta=THREE.MathUtils.degToRad(localSiderealDegrees(date,lonDeg));
  const phi=THREE.MathUtils.degToRad(latDeg);
  const eps=THREE.MathUtils.degToRad(meanObliquityFromDate(date));

  return normalize360(
    THREE.MathUtils.radToDeg(
      Math.atan2(
        -Math.cos(theta),
        Math.sin(theta)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)
      )
    )+180
  );
}

function meanNodeTropicalLongitude(date){
  const T=(julianDate(date)-2451545.0)/36525;
  return normalize360(
    125.04452-
    1934.136261*T+
    .0020708*T*T+
    (T*T*T)/450000
  );
}

function greenwichSiderealDegrees(date){
  return localSiderealDegrees(date,0);
}

function normalize360(x){
  return ((x%360)+360)%360;
}

function fullZodiac(lon){
  const x=normalize360(lon);
  const i=Math.floor(x/30);
  const within=x-i*30;
  const d=Math.floor(within);
  const m=Math.floor((within-d)*60);
  return `${SIGNS[i][1]} ${SIGNS[i][0]} ${d}°${String(m).padStart(2,'0')}′`;
}

function degreeInSign(lon){
  const x=normalize360(lon)%30;
  const d=Math.floor(x);
  const m=Math.floor((x-d)*60);
  return `${d}°${String(m).padStart(2,'0')}′`;
}
