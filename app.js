const A = window.Astronomy;

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

const SIGN_LORDS = [
  'Mars','Venus','Mercury','Moon','Sun','Mercury',
  'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'
];

const NAK_LORD_SEQUENCE = [
  'Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'
];

const CLASSICAL_GRAHAS=new Set(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']);

const OWN_SIGNS={
  Sun:[4], Moon:[3], Mars:[0,7], Mercury:[2,5],
  Jupiter:[8,11], Venus:[1,6], Saturn:[9,10]
};

const EXALTATION_SIGNS={
  Sun:0, Moon:1, Mars:9, Mercury:5, Jupiter:3, Venus:11, Saturn:6
};

const DEBILITATION_SIGNS={
  Sun:6, Moon:7, Mars:3, Mercury:11, Jupiter:9, Venus:5, Saturn:0
};

const NATURAL_RELATIONS={
  Sun:{friends:['Moon','Mars','Jupiter'],enemies:['Venus','Saturn']},
  Moon:{friends:['Sun','Mercury'],enemies:[]},
  Mars:{friends:['Sun','Moon','Jupiter'],enemies:['Mercury']},
  Mercury:{friends:['Sun','Venus'],enemies:['Moon']},
  Jupiter:{friends:['Sun','Moon','Mars'],enemies:['Mercury','Venus']},
  Venus:{friends:['Mercury','Saturn'],enemies:['Sun','Moon']},
  Saturn:{friends:['Mercury','Venus'],enemies:['Sun','Moon','Mars']}
};

const COMBUSTION_ORBS={
  Moon:12, Mars:17, Mercury:14, Jupiter:11, Venus:10, Saturn:15
};

const NAK_SIZE = 360/27;
const canvas = document.getElementById('worldCanvas');
const ctx = canvas.getContext('2d');
const lightCanvas = document.createElement('canvas');
lightCanvas.width = 240;
lightCanvas.height = 120;
const lightCtx = lightCanvas.getContext('2d');

const risingCanvas = document.createElement('canvas');
risingCanvas.width = 360;
risingCanvas.height = 180;
const risingCtx = risingCanvas.getContext('2d');
const focusCanvas = document.createElement('canvas');
focusCanvas.width = 360;
focusCanvas.height = 180;
const focusCtx = focusCanvas.getContext('2d');
const gandantaCanvas = document.createElement('canvas');
gandantaCanvas.width = 360;
gandantaCanvas.height = 180;
const gandantaCtx = gandantaCanvas.getContext('2d');

const state = {
  land: [],
  land50: [],
  admin1Boundaries: [],
  playing: false,
  speed: 1,
  offsetMs: 0,
  frozenDateMs: null,
  epochAstro: Date.now(),
  epochReal: performance.now(),
  lastDraw: 0,
  astro: null,
  mapReady: false,
  observer: null,
  risingCacheKey: '',
  risingSignGrid: null,
  risingNakGrid: null,
  risingGandantaGrid: null,
  focusSign: null,
  focusNak: null,
  panDeg: 0,
  dragging: false,
  dragX: 0,
  dragStartX: 0,
  dragStartY: 0,
  selectedPoint: null,
  countryLabels: [],
  admin1Labels: [],
  countryRegions: [],
  admin1Regions: [],
  labelsReady: false,
  newsCache: new Map(),
  newsSeq: 0,
  zoom: 1,
  viewOffsetX: 0,
  viewOffsetY: 0,
  atmosphere: {
    loaded:false,
    loading:false,
    kp:null,
    solarWind:null,
    density:null,
    bz:null,
    bt:null,
    interference:'—',
    tecImage:null,
    tecUpdated:null,
    lightningAvailable:false,
    status:'Atmospheric feeds not loaded yet.'
  }
};

init();

async function init(){
  buildNakshatraKey();
  populateFocusControls();
  bindControls();
  updateZoomText();
  loadPoliticalLabels();
  loadAtmosphericEnergy();
  setInterval(loadAtmosphericEnergy, 5 * 60_000);
  resize();
  window.addEventListener('resize', resize);

  try{
    const r = await fetch('/world-land.geojson', { cache:'force-cache' });
    if(!r.ok) throw new Error('World map HTTP '+r.status);
    const geo = await r.json();
    state.land = extractPolygons(geo);
    state.mapReady = true;
    document.getElementById('statusText').textContent='World geometry loaded · Lahiri sidereal';
    draw();
  }catch(err){
    console.error(err);
    document.getElementById('statusText').textContent='World geometry failed to load';
  }

  refreshAstronomy();
  requestAnimationFrame(loop);
}

function bindControls(){
  syncDateTimeInputs(currentDate());
  document.querySelectorAll('[data-minutes]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      freezePlayback();
      const target=new Date(currentDate().getTime()+Number(btn.dataset.minutes)*60000);
      setCompassDate(target);
    });
  });

  document.querySelectorAll('[data-years]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      freezePlayback();
      const d=currentDate();
      const years=Number(btn.dataset.years)||0;
      const target=new Date(d.getTime());
      target.setUTCFullYear(target.getUTCFullYear()+years);
      setCompassDate(target);
    });
  });

  document.getElementById('applyDateTimeBtn').addEventListener('click',()=>{
    const dateValue=document.getElementById('dateInput').value;
    const timeValue=document.getElementById('timeInput').value||'00:00';
    const status=document.getElementById('dateEntryStatus');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)||!/^\d{2}:\d{2}$/.test(timeValue)){
      status.textContent='Enter a valid UTC date and time';
      return;
    }
    const [y,m,d]=dateValue.split('-').map(Number);
    const [hh,mm]=timeValue.split(':').map(Number);
    if(y<1900||y>2100){
      status.textContent='Supported entry range: 1900–2100 UTC';
      return;
    }
    const target=new Date(Date.UTC(y,m-1,d,hh,mm,0,0));
    if(!Number.isFinite(target.getTime())){
      status.textContent='Invalid UTC date/time';
      return;
    }
    setCompassDate(target);
  });

  document.getElementById('resetBtn').addEventListener('click',()=>{
    state.playing=false;
    state.offsetMs=0;
    state.frozenDateMs=null;
    document.getElementById('playBtn').textContent='▶ Play';
    refreshAstronomy();
    syncDateTimeInputs(currentDate());
  });

  document.getElementById('playBtn').addEventListener('click',()=>{
    if(!state.playing){
      state.epochAstro=currentDate().getTime();
      state.epochReal=performance.now();
      state.playing=true;
      document.getElementById('playBtn').textContent='⏸ Pause';
    }else{
      freezePlayback();
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

  ['showDayNight','showZodiac','showNakshatras','showGandanta','showPlanets','showGrid','showPlaceLabels','showTecAnomaly','showGeomagnetic','showLightning']
    .forEach(id=>document.getElementById(id).addEventListener('change',draw));
  document.getElementById('refreshAtmosBtn').addEventListener('click',loadAtmosphericEnergy);

  document.getElementById('focusSignSelect').addEventListener('change',e=>{
    state.focusSign=e.target.value===''?null:Number(e.target.value);
    if(state.focusSign!==null){
      state.focusNak=null;
      document.getElementById('focusNakSelect').value='';
    }
    updateFocusSummary();
    draw();
  });

  document.getElementById('focusNakSelect').addEventListener('change',e=>{
    state.focusNak=e.target.value===''?null:Number(e.target.value);
    if(state.focusNak!==null){
      state.focusSign=null;
      document.getElementById('focusSignSelect').value='';
    }
    updateFocusSummary();
    draw();
  });

  document.getElementById('clearFocusBtn').addEventListener('click',()=>{
    state.focusSign=null;
    state.focusNak=null;
    document.getElementById('focusSignSelect').value='';
    document.getElementById('focusNakSelect').value='';
    updateFocusSummary();
    draw();
  });

  document.getElementById('applyLocationBtn').addEventListener('click',()=>{
    applyObserver(
      document.getElementById('latitudeInput').value,
      document.getElementById('longitudeInput').value
    );
  });

  document.getElementById('useLocationBtn').addEventListener('click',()=>{
    const status=document.getElementById('locationStatus');
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

    const collapseBtn=document.getElementById('collapsePanelBtn');
  const reopenBtn=document.getElementById('panelReopenBtn');
  const panel=document.querySelector('.control-panel');

  collapseBtn.addEventListener('click',()=>{
    panel.hidden=true;
    reopenBtn.hidden=false;
  });

  reopenBtn.addEventListener('click',()=>{
    panel.hidden=false;
    reopenBtn.hidden=true;
  });

  canvas.addEventListener('pointerdown',e=>{
    state.dragging=true;
    state.dragX=e.clientX;
    state.dragY=e.clientY;
    state.dragStartX=e.clientX;
    state.dragStartY=e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove',e=>{
    if(!state.dragging) return;
    const dx=e.clientX-state.dragX;
    const dy=e.clientY-state.dragY;
    state.dragX=e.clientX;
    state.dragY=e.clientY;
    const w=Math.max(1,canvas.clientWidth);
    state.panDeg=normalize180(state.panDeg+dx/(w*state.zoom)*360);
    if(state.zoom>1){
      state.viewOffsetY=clampViewOffsetY(state.viewOffsetY+dy,canvas.clientHeight,state.zoom);
    }
    draw();
  });

  canvas.addEventListener('pointerup',e=>{
    const moved=Math.hypot(e.clientX-state.dragStartX,e.clientY-state.dragStartY);
    state.dragging=false;
    try{canvas.releasePointerCapture?.(e.pointerId);}catch{}
    if(moved<7) inspectMapPoint(e.clientX,e.clientY);
  });

  canvas.addEventListener('pointercancel',e=>{
    state.dragging=false;
    try{canvas.releasePointerCapture?.(e.pointerId);}catch{}
  });

  canvas.addEventListener('pointerleave',e=>{
    if(e.buttons===0) state.dragging=false;
  });

  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const factor=e.deltaY<0?1.18:1/1.18;
    zoomAtPoint(state.zoom*factor,e.clientX,e.clientY);
  },{passive:false});

  document.getElementById('zoomInBtn').addEventListener('click',()=>{
    const r=canvas.getBoundingClientRect();
    zoomAtPoint(state.zoom*1.35,r.left+r.width/2,r.top+r.height/2);
  });

  document.getElementById('zoomOutBtn').addEventListener('click',()=>{
    const r=canvas.getBoundingClientRect();
    zoomAtPoint(state.zoom/1.35,r.left+r.width/2,r.top+r.height/2);
  });

  document.getElementById('resetViewBtn').addEventListener('click',()=>{
    state.zoom=1;
    state.viewOffsetX=0;
    state.viewOffsetY=0;
    state.panDeg=0;
    updateZoomText();
    draw();
  });

  document.getElementById('closeInspectBtn').addEventListener('click',()=>{
    document.getElementById('locationInspectPanel').hidden=true;
    state.selectedPoint=null;
    draw();
  });
}

function freezePlayback(){
  if(state.playing){
    state.frozenDateMs=currentDate().getTime();
  }
  state.playing=false;
  document.getElementById('playBtn').textContent='▶ Play';
}

function setCompassDate(target){
  const min=Date.UTC(1900,0,1,0,0,0,0),max=Date.UTC(2100,11,31,23,59,59,999);
  const t=Math.min(max,Math.max(min,target.getTime()));
  state.playing=false;
  state.offsetMs=0;
  state.frozenDateMs=t;
  state.epochAstro=t;
  state.epochReal=performance.now();
  const play=document.getElementById('playBtn');
  if(play)play.textContent='▶ Play';
  refreshAstronomy();
  syncDateTimeInputs(new Date(t));
}
function syncDateTimeInputs(date){
  const dateInput=document.getElementById('dateInput');
  const timeInput=document.getElementById('timeInput');
  const status=document.getElementById('dateEntryStatus');
  if(!dateInput||!timeInput)return;
  const y=date.getUTCFullYear(),m=String(date.getUTCMonth()+1).padStart(2,'0'),d=String(date.getUTCDate()).padStart(2,'0');
  const hh=String(date.getUTCHours()).padStart(2,'0'),mm=String(date.getUTCMinutes()).padStart(2,'0');
  dateInput.value=y+'-'+m+'-'+d;
  timeInput.value=hh+':'+mm;
  if(status)status.textContent='UTC · '+y+'-'+m+'-'+d+' '+hh+':'+mm;
}

function currentDate(){
  if(state.playing){
    return new Date(state.epochAstro+(performance.now()-state.epochReal)*state.speed);
  }
  if(Number.isFinite(state.frozenDateMs)){
    return new Date(state.frozenDateMs);
  }
  return new Date(Date.now());
}

function loop(now){
  requestAnimationFrame(loop);
  if(now-state.lastDraw<33) return;
  state.lastDraw=now;

  if(state.playing || !state.astro || now-(state.astro.realStamp||0)>1000){
    refreshAstronomy();
  }else{
    draw();
  }
}

function refreshAstronomy(){
  const date=currentDate();
  if(!A){
    document.getElementById('statusText').textContent='Astronomy Engine unavailable';
    return;
  }

  try{
    syncDateTimeInputs(date);
    const aya=lahiriAyanamsa(date);
    const eps=meanObliquityFromDate(date);
    const gmst=greenwichSiderealDegrees(date);
    const sun=solarCoordinates(date);

    const placements=[];
    for(const [name,bodyKey,glyph,color] of PLANETS){
      try{
        const body=A.Body?.[bodyKey];
        if(body===undefined || body===null) throw new Error('Body not available: '+bodyKey);
        const vec=A.GeoVector(body,date,true);
        const ecl=A.Ecliptic(vec);
        const lon=Number(ecl?.elon);
        if(!Number.isFinite(lon)) throw new Error('Invalid longitude for '+name);
        placements.push({name,glyph,color,lon:normalize360(lon-aya),source:'apparent geocentric · true ecliptic of date'});
      }catch(bodyErr){
        console.error('Planet calculation failed:',name,bodyErr);
      }
    }

    const rahu=normalize360(meanNodeTropicalLongitude(date)-aya);
    placements.push(
      {name:'Rahu',glyph:'☊',color:'#06d6a0',lon:rahu,source:'mean lunar node'},
      {name:'Ketu',glyph:'☋',color:'#ef476f',lon:normalize360(rahu+180),source:'mean lunar node'}
    );

    state.astro={date,aya,eps,gmst,sun,placements,realStamp:performance.now()};
    document.getElementById('statusText').textContent=
      `World loaded · Lahiri sidereal · ${placements.length} bodies`;
    updateText();
    if(state.selectedPoint){
      updateLocationReading(state.selectedPoint.lat,state.selectedPoint.lon,date);
    }
    draw();
  }catch(err){
    console.error('Astronomy refresh failed:',err);
    document.getElementById('statusText').textContent=
      'Astronomy layer error · map remains available';
    draw();
  }
}

function draw(){
  const w=canvas.clientWidth;
  const h=canvas.clientHeight;
  if(!w||!h) return;

  ctx.clearRect(0,0,w,h);
  drawBackground(w,h);

  const frameDate = currentDate();
  const phase = normalize360(greenwichSiderealDegrees(frameDate));
  // Full eastward Earth rotation: one complete wrap per sidereal day.
  const earthShiftDeg = normalize180(phase + state.panDeg);

  ctx.save();
  applyMapViewTransform(w,h);

  if(document.getElementById('showGrid').checked) drawGrid(w,h,earthShiftDeg);
  if(state.mapReady) drawLand(w,h,earthShiftDeg);

  drawAtmosphericLayers(w,h,earthShiftDeg);

  if(state.astro){
    if(document.getElementById('showDayNight').checked){
      drawDayNight(w,h,earthShiftDeg);
    }

    drawRisingField(w,h,earthShiftDeg,frameDate);

    if(document.getElementById('showPlaceLabels').checked){
      drawPoliticalLabels(w,h,earthShiftDeg);
    }

    drawZodiacDegreeGrid(w,h);

    if(document.getElementById('showPlanets').checked){
      drawProjectedPlanets(w,h,earthShiftDeg);
    }

    drawObserverMarker(w,h,earthShiftDeg,frameDate);
    drawSelectedPoint(w,h,earthShiftDeg);
  }

  ctx.restore();
  drawEdgeFade(w,h);
}

function applyMapViewTransform(w,h){
  ctx.translate(w/2+state.viewOffsetX,h/2+state.viewOffsetY);
  ctx.scale(state.zoom,state.zoom);
  ctx.translate(-w/2,-h/2);
}

function screenToMapPoint(screenX,screenY,w,h){
  return {
    x:(screenX-(w/2+state.viewOffsetX))/state.zoom+w/2,
    y:(screenY-(h/2+state.viewOffsetY))/state.zoom+h/2
  };
}

function zoomAtPoint(nextZoom,clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  const oldZoom=state.zoom;
  const newZoom=Math.max(1,Math.min(8,nextZoom));
  if(Math.abs(newZoom-oldZoom)<.001) return;

  const sx=clientX-rect.left;
  const sy=clientY-rect.top;
  const mapPoint=screenToMapPoint(sx,sy,rect.width,rect.height);

  state.zoom=newZoom;
  state.viewOffsetX=
    sx-rect.width/2-newZoom*(mapPoint.x-rect.width/2);
  state.viewOffsetY=
    sy-rect.height/2-newZoom*(mapPoint.y-rect.height/2);

  state.viewOffsetX=clampViewOffsetX(state.viewOffsetX,rect.width,newZoom);
  state.viewOffsetY=clampViewOffsetY(state.viewOffsetY,rect.height,newZoom);
  updateZoomText();
  draw();
}

function clampViewOffsetX(value,w,zoom){
  const limit=(zoom-1)*w/2;
  return Math.max(-limit,Math.min(limit,value));
}

function clampViewOffsetY(value,h,zoom){
  const limit=(zoom-1)*h/2;
  return Math.max(-limit,Math.min(limit,value));
}

function updateZoomText(){
  const el=document.getElementById('zoomLevelText');
  if(el) el.textContent=state.zoom.toFixed(1)+'×';
}

function drawBackground(w,h){
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#071321');
  g.addColorStop(.5,'#05101c');
  g.addColorStop(1,'#020812');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,w,h);
}

function drawGrid(w,h,shiftDeg){
  ctx.save();
  ctx.strokeStyle='rgba(130,180,210,.13)';
  ctx.lineWidth=1;

  for(let lat=-60;lat<=60;lat+=30){
    const y=latToY(lat,h);
    ctx.beginPath();
    ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
  }

  for(let lng=-180;lng<180;lng+=30){
    const x=lonToX(lng+shiftDeg,w);
    for(const xx of wrappedXs(x,w)){
      ctx.beginPath();
      ctx.moveTo(xx,0);ctx.lineTo(xx,h);ctx.stroke();
    }
  }

  ctx.restore();
}

function drawLand(w,h,shiftDeg){
  const useDetailed=state.zoom>=2 && state.land50.length;
  const source=useDetailed?state.land50:state.land;

  ctx.save();
  ctx.fillStyle='#183c52';
  ctx.strokeStyle='rgba(135,201,229,.48)';
  ctx.lineWidth=.8/Math.max(1,Math.sqrt(state.zoom));

  for(const poly of source){
    drawPolygon(poly,w,h,shiftDeg);
  }

  if(state.zoom>=2.2 && state.admin1Boundaries.length){
    drawAdmin1Boundaries(w,h,shiftDeg);
  }

  ctx.restore();
}

function drawPolygon(rings,w,h,shiftDeg){
  for(const copy of [-1,0,1]){
    const dx=copy*w;
    ctx.beginPath();

    for(const ring of rings){
      if(!ring.length) continue;
      let started=false;
      let lastX=null;

      for(const coord of ring){
        const lng=normalize180(coord[0]+shiftDeg);
        let x=lonToX(lng,w)+dx;
        const y=latToY(coord[1],h);

        if(lastX!==null && Math.abs(x-lastX)>w*.5){
          started=false;
        }

        if(!started){ctx.moveTo(x,y);started=true;}
        else ctx.lineTo(x,y);

        lastX=x;
      }
      ctx.closePath();
    }

    ctx.fill('evenodd');
    ctx.stroke();
  }
}

function extractFeatureLines(features){
  const out=[];
  const addGeometry=geometry=>{
    if(!geometry) return;
    if(geometry.type==='Polygon'){
      geometry.coordinates.forEach(ring=>out.push(ring));
    }else if(geometry.type==='MultiPolygon'){
      geometry.coordinates.forEach(poly=>poly.forEach(ring=>out.push(ring)));
    }else if(geometry.type==='LineString'){
      out.push(geometry.coordinates);
    }else if(geometry.type==='MultiLineString'){
      geometry.coordinates.forEach(line=>out.push(line));
    }
  };
  features.forEach(f=>addGeometry(f.geometry));
  return out;
}

function drawAdmin1Boundaries(w,h,shiftDeg){
  ctx.save();
  ctx.strokeStyle='rgba(176,207,222,.30)';
  ctx.lineWidth=.65/Math.max(1,Math.sqrt(state.zoom));
  ctx.setLineDash([2/state.zoom,2/state.zoom]);

  for(const line of state.admin1Boundaries){
    for(const copy of [-1,0,1]){
      const dx=copy*w;
      let started=false;
      let lastX=null;
      ctx.beginPath();

      for(const coord of line){
        const lng=normalize180(coord[0]+shiftDeg);
        const x=lonToX(lng,w)+dx;
        const y=latToY(coord[1],h);

        if(lastX!==null && Math.abs(x-lastX)>w*.5) started=false;
        if(!started){ctx.moveTo(x,y);started=true;}
        else ctx.lineTo(x,y);
        lastX=x;
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

async function loadAtmosphericEnergy(){
  if(state.atmosphere.loading)return;
  state.atmosphere.loading=true;
  updateAtmospherePanel('Loading NOAA atmospheric feeds…');

  const safeJson=async url=>{
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  };

  const results=await Promise.allSettled([
    safeJson('/api/space-weather?ts='+Date.now()),
    safeJson('https://services.swpc.noaa.gov/products/animations/glotec/anomaly_urt.json')
  ]);

  const sw=results[0].status==='fulfilled'?results[0].value:null;
  const tecData=results[1].status==='fulfilled'?results[1].value:null;

  state.atmosphere.kp=Number(sw?.kp?.value);
  state.atmosphere.solarWind=Number(sw?.wind?.speed);
  state.atmosphere.density=Number(sw?.wind?.density);
  state.atmosphere.bz=Number(sw?.mag?.bz);
  state.atmosphere.bt=Number(sw?.mag?.bt);

  const kp=state.atmosphere.kp;
  const bz=state.atmosphere.bz;
  const speed=state.atmosphere.solarWind;
  let score=0;
  if(Number.isFinite(kp))score+=kp>=7?3:kp>=5?2:kp>=4?1:0;
  if(Number.isFinite(bz))score+=bz<=-10?2:bz<=-5?1:0;
  if(Number.isFinite(speed))score+=speed>=700?2:speed>=500?1:0;
  state.atmosphere.interference=score>=5?'HIGH':score>=3?'ELEVATED':score>=1?'WATCH':'LOW';

  const tecUrl=findLatestImageUrl(tecData);
  if(tecUrl){
    try{
      const img=new Image();
      img.crossOrigin='anonymous';
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=reject;img.src=normalizeNoaaImageUrl(tecUrl);
      });
      state.atmosphere.tecImage=img;
      state.atmosphere.tecUpdated=new Date();
    }catch(e){
      console.warn('TEC image unavailable',e);
      state.atmosphere.tecImage=null;
    }
  }

  state.atmosphere.lightningAvailable=true;
  state.atmosphere.loaded=true;
  state.atmosphere.loading=false;

  const details=[];
  if(Number.isFinite(state.atmosphere.density))details.push('density '+state.atmosphere.density.toFixed(1)+' p/cm³');
  if(Number.isFinite(state.atmosphere.bt))details.push('Bt '+state.atmosphere.bt.toFixed(1)+' nT');
  details.push('interference '+state.atmosphere.interference);

  const available=[
    Number.isFinite(state.atmosphere.kp)?'Kp':'',
    Number.isFinite(state.atmosphere.solarWind)?'solar wind':'',
    Number.isFinite(state.atmosphere.bz)?'Bz':'',
    state.atmosphere.tecImage?'GloTEC anomaly':''
  ].filter(Boolean);

  updateAtmospherePanel(
    available.length
      ? 'Live NOAA: '+available.join(' · ')+' · '+details.join(' · ')+' · GLM lightning source ready'
      : 'Atmospheric feeds unavailable'
  );
  draw();
}

function parseLatestKp(data){
  if(!Array.isArray(data)||!data.length)return null;
  if(Array.isArray(data[0])){
    const header=data[0].map(x=>String(x).toLowerCase());
    const kpI=header.findIndex(x=>x==='kp'||x.includes('kp'));
    for(let i=data.length-1;i>=1;i--){
      const v=Number(data[i]?.[kpI>=0?kpI:1]);
      if(Number.isFinite(v))return v;
    }
  }
  for(let i=data.length-1;i>=0;i--){
    const r=data[i]||{};
    const v=Number(r.kp??r.Kp??r.k_index??r.value);
    if(Number.isFinite(v))return v;
  }
  return null;
}

function parseSummaryNumber(data,keys,preferBz=false){
  const scan=obj=>{
    if(obj==null)return null;
    if(typeof obj==='number'&&Number.isFinite(obj))return obj;
    if(typeof obj==='string'){
      const m=obj.match(/-?\d+(?:\.\d+)?/);
      return m?Number(m[0]):null;
    }
    if(Array.isArray(obj)){
      for(let i=obj.length-1;i>=0;i--){const v=scan(obj[i]);if(Number.isFinite(v))return v}
      return null;
    }
    if(typeof obj==='object'){
      const entries=Object.entries(obj);
      const ordered=preferBz
        ? [...entries].sort(([a],[b])=>(/bz/i.test(a)?-1:0)-(/bz/i.test(b)?-1:0))
        : entries;
      for(const [k,v] of ordered){
        if(keys.some(key=>k.toLowerCase().includes(key.toLowerCase()))){
          const n=scan(v);if(Number.isFinite(n))return n;
        }
      }
      for(const [,v] of entries){const n=scan(v);if(Number.isFinite(n))return n}
    }
    return null;
  };
  return scan(data);
}

function findLatestImageUrl(data){
  const found=[];
  const walk=v=>{
    if(typeof v==='string'){
      if(/\.(?:png|jpe?g|webp)(?:\?|$)/i.test(v))found.push(v);
    }else if(Array.isArray(v))v.forEach(walk);
    else if(v&&typeof v==='object')Object.values(v).forEach(walk);
  };
  walk(data);
  return found.length?found[found.length-1]:null;
}

function normalizeNoaaImageUrl(url){
  if(/^https?:\/\//i.test(url))return url;
  if(url.startsWith('/'))return 'https://services.swpc.noaa.gov'+url;
  if(url.startsWith('images/'))return 'https://services.swpc.noaa.gov/'+url;
  return 'https://services.swpc.noaa.gov/images/animations/glotec/'+url.replace(/^\.\//,'');
}

function updateAtmospherePanel(message){
  state.atmosphere.status=message;
  const kp=document.getElementById('kpText');
  const sw=document.getElementById('solarWindText');
  const bz=document.getElementById('bzText');
  const status=document.getElementById('atmosStatus');
  if(kp)kp.textContent=Number.isFinite(state.atmosphere.kp)?state.atmosphere.kp.toFixed(1):'—';
  if(sw)sw.textContent=Number.isFinite(state.atmosphere.solarWind)?Math.round(state.atmosphere.solarWind)+' km/s':'—';
  if(bz)bz.textContent=Number.isFinite(state.atmosphere.bz)?state.atmosphere.bz.toFixed(1)+' nT':'—';
  if(status)status.textContent=message;
}

function drawAtmosphericLayers(w,h,earthShiftDeg){
  const a=state.atmosphere;
  const tec=document.getElementById('showTecAnomaly')?.checked;
  const geomag=document.getElementById('showGeomagnetic')?.checked;
  const lightning=document.getElementById('showLightning')?.checked;

  if(tec&&a.tecImage){
    ctx.save();
    ctx.globalAlpha=.32;
    ctx.globalCompositeOperation='screen';
    for(const copy of [-1,0,1]){
      ctx.drawImage(a.tecImage,earthShiftDeg/360*w+copy*w,0,w,h);
    }
    ctx.restore();
  }

  if(geomag&&Number.isFinite(a.kp)){
    const strength=Math.max(0,Math.min(1,a.kp/9));
    if(strength>0){
      ctx.save();
      const north=ctx.createLinearGradient(0,0,0,h*.40);
      north.addColorStop(0,`rgba(72,202,228,${.08+.30*strength})`);
      north.addColorStop(1,'rgba(72,202,228,0)');
      ctx.fillStyle=north;ctx.fillRect(0,0,w,h*.42);

      const south=ctx.createLinearGradient(0,h*.60,0,h);
      south.addColorStop(0,'rgba(157,78,221,0)');
      south.addColorStop(1,`rgba(157,78,221,${.08+.30*strength})`);
      ctx.fillStyle=south;ctx.fillRect(0,h*.58,w,h*.42);
      ctx.restore();
    }
  }

  if(lightning){
    ctx.save();
    ctx.font='700 9px system-ui,sans-serif';
    ctx.textAlign='right';
    ctx.fillStyle='rgba(255,214,102,.92)';
    ctx.shadowColor='rgba(0,0,0,.85)';
    ctx.shadowBlur=4;
    ctx.fillText('GLM LIGHTNING · NOAA satellite coverage',w-12,h-18);
    ctx.restore();
  }
}

function drawDayNight(w,h,earthShiftDeg){
  const {subsolarLat,subsolarLon}=state.astro.sun;
  const lw=lightCanvas.width;
  const lh=lightCanvas.height;
  lightCtx.clearRect(0,0,lw,lh);

  for(let py=0;py<lh;py++){
    const lat=yToLat(py,lh);
    const latR=rad(lat);
    const sunLatR=rad(subsolarLat);

    for(let px=0;px<lw;px++){
      const mapLng=xToLon(px,lw);
      const earthLng=normalize180(mapLng-earthShiftDeg);
      const H=rad(normalize180(earthLng-subsolarLon));
      const cosZ=
        Math.sin(latR)*Math.sin(sunLatR)+
        Math.cos(latR)*Math.cos(sunLatR)*Math.cos(H);

      if(cosZ<0){
        const darkness=Math.min(.72,.20+(-cosZ)*.52);
        lightCtx.fillStyle=`rgba(0,4,12,${darkness})`;
        lightCtx.fillRect(px,py,1,1);
      }
    }
  }

  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(lightCanvas,0,0,w,h);

  // Approximate day/night boundary.
  ctx.strokeStyle='rgba(148,210,236,.48)';
  ctx.lineWidth=1.15;
  ctx.beginPath();
  let pen=false;
  for(let x=0;x<=w;x+=3){
    const mapLng=xToLon(x,w);
    const earthLng=normalize180(mapLng-earthShiftDeg);
    const H=rad(normalize180(earthLng-subsolarLon));
    const sunLatR=rad(subsolarLat);
    const tanSun=Math.tan(sunLatR);
    if(Math.abs(tanSun)<1e-5){pen=false;continue;}
    const lat=Math.atan(-Math.cos(H)/tanSun)*180/Math.PI;
    if(!Number.isFinite(lat)||Math.abs(lat)>90){pen=false;continue;}
    const y=latToY(lat,h);
    if(!pen){ctx.moveTo(x,y);pen=true;}else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawRisingField(w,h,earthShiftDeg,frameDate){
  const showZodiac=document.getElementById('showZodiac').checked;
  const showNak=document.getElementById('showNakshatras').checked;
  const showGandanta=document.getElementById('showGandanta').checked;
  if(!showZodiac && !showNak && !showGandanta) return;

  buildRisingCache(frameDate,showZodiac,showNak);

  if(showZodiac || showNak){
    drawWrappedCanvas(risingCanvas,w,h,earthShiftDeg);
    drawZoneBoundaries(w,h,showZodiac,showNak,earthShiftDeg);
    drawFocusOverlay(w,h,earthShiftDeg);
    drawRisingLabels(w,h,showZodiac,showNak,earthShiftDeg);
  }

  if(showGandanta){
    drawGandantaOverlay(w,h,earthShiftDeg);
  }
}

function buildRisingCache(date,showZodiac,showNak){
  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  const minuteKey=date.toISOString().slice(0,16);
  const cacheKey=`${minuteKey}|${showZodiac?1:0}|${showNak?1:0}`;
  if(state.risingCacheKey===cacheKey && state.risingSignGrid && state.risingNakGrid) return;

  const img=risingCtx.createImageData(rw,rh);
  const data=img.data;
  const signGrid=new Uint8Array(rw*rh);
  const nakGrid=new Uint8Array(rw*rh);
  const gandantaGrid=new Uint8Array(rw*rh);
  const aya=lahiriAyanamsa(date);

  for(let py=0;py<rh;py++){
    const lat=yToLat(py+.5,rh);

    for(let px=0;px<rw;px++){
      const earthLng=xToLon(px+.5,rw);
      const asc=normalize360(tropicalAscendant(date,lat,earthLng)-aya);
      const signIndex=Math.floor(asc/30);
      const nakIndex=Math.min(26,Math.floor(asc/NAK_SIZE));
      const cell=py*rw+px;

      signGrid[cell]=signIndex;
      nakGrid[cell]=nakIndex;
      gandantaGrid[cell]=isGandanta(asc)?1:0;

      const signColor=hexToRgb(SIGNS[signIndex][2]);
      const nakColor=hslToRgb(nakIndex/27,.72,.58);

      let r=signColor[0],g=signColor[1],b=signColor[2],alpha=0;
      if(showZodiac) alpha=.19;

      if(showNak){
        if(showZodiac){
          r=Math.round(r*.72+nakColor[0]*.28);
          g=Math.round(g*.72+nakColor[1]*.28);
          b=Math.round(b*.72+nakColor[2]*.28);
          alpha=.22;
        }else{
          r=nakColor[0];g=nakColor[1];b=nakColor[2];alpha=.16;
        }
      }

      const p=cell*4;
      data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=Math.round(alpha*255);
    }
  }

  risingCtx.putImageData(img,0,0);

  state.risingSignGrid=signGrid;
  state.risingNakGrid=nakGrid;
  state.risingGandantaGrid=gandantaGrid;
  state.risingCacheKey=cacheKey;
}

function drawZoneBoundaries(w,h,showZodiac,showNak,earthShiftDeg){
  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  if(!state.risingSignGrid || !state.risingNakGrid) return;

  if(showZodiac){
    const signPaths=collectBoundaryPaths(state.risingSignGrid,rw,rh);
    for(const path of signPaths){
      const a=path.a,b=path.b;
      const colorA=hexToRgb(SIGNS[a][2]);
      const colorB=hexToRgb(SIGNS[b][2]);
      const mix=[
        Math.round((colorA[0]+colorB[0])/2),
        Math.round((colorA[1]+colorB[1])/2),
        Math.round((colorA[2]+colorB[2])/2)
      ];
      strokeBoundaryPath(path.points,w,h,earthShiftDeg,`rgba(${mix[0]},${mix[1]},${mix[2]},.90)`,2.0);
    }
  }

  if(showNak){
    const nakPaths=collectBoundaryPaths(state.risingNakGrid,rw,rh);
    for(const path of nakPaths){
      const colorA=hslToRgb(path.a/27,.72,.58);
      const colorB=hslToRgb(path.b/27,.72,.58);
      const mix=[
        Math.round((colorA[0]+colorB[0])/2),
        Math.round((colorA[1]+colorB[1])/2),
        Math.round((colorA[2]+colorB[2])/2)
      ];
      strokeBoundaryPath(path.points,w,h,earthShiftDeg,`rgba(${mix[0]},${mix[1]},${mix[2]},.30)`,.8);
    }
  }

  function collectBoundaryPaths(grid,width,height){
    const groups=new Map();

    for(let y=1;y<height-1;y++){
      for(let x=1;x<width;x++){
        const left=grid[y*width+x-1];
        const right=grid[y*width+x];
        if(left===right) continue;

        const a=Math.min(left,right);
        const b=Math.max(left,right);
        const key=`${a}-${b}`;
        if(!groups.has(key)) groups.set(key,{a,b,points:[]});
        groups.get(key).points.push({x,y});
      }
    }

    return [...groups.values()];
  }

  function strokeBoundaryPath(pointsInfo,screenW,screenH,shiftDeg,stroke,width){
    if(pointsInfo.length<2) return;

    const shiftPx=shiftDeg/360*screenW;
    const basePts=pointsInfo
      .map(p=>({x:p.x/rw*screenW+shiftPx,y:p.y/rh*screenH}))
      .sort((a,b)=>a.y-b.y || a.x-b.x);

    for(const copy of [-1,0,1]){
      const dx=copy*screenW;
      ctx.save();
      ctx.strokeStyle=stroke;
      ctx.lineWidth=width;
      ctx.lineJoin='round';
      ctx.lineCap='round';
      ctx.beginPath();

      let prev=null;
      for(const raw of basePts){
        const p={x:raw.x+dx,y:raw.y};
        if(!prev || Math.abs(p.x-prev.x)>screenW*.18 || Math.abs(p.y-prev.y)>screenH*.08){
          ctx.moveTo(p.x,p.y);
        }else{
          const mx=(prev.x+p.x)/2;
          const my=(prev.y+p.y)/2;
          ctx.quadraticCurveTo(prev.x,prev.y,mx,my);
        }
        prev=p;
      }

      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawGandantaOverlay(w,h,earthShiftDeg){
  if(!state.risingGandantaGrid) return;

  const rw=gandantaCanvas.width;
  const rh=gandantaCanvas.height;
  const img=gandantaCtx.createImageData(rw,rh);
  const data=img.data;

  for(let i=0;i<state.risingGandantaGrid.length;i++){
    if(!state.risingGandantaGrid[i]) continue;
    const p=i*4;
    data[p]=255;
    data[p+1]=176;
    data[p+2]=72;
    data[p+3]=88;
  }
  gandantaCtx.putImageData(img,0,0);
  drawWrappedCanvas(gandantaCanvas,w,h,earthShiftDeg);
  drawGandantaLabels(w,h,earthShiftDeg);
}

function drawGandantaLabels(w,h,earthShiftDeg){
  const grid=state.risingGandantaGrid;
  if(!grid) return;
  const rw=gandantaCanvas.width;
  const rh=gandantaCanvas.height;
  const row=Math.floor(rh*.34);
  let start=-1;

  for(let x=0;x<=rw;x++){
    const on=x<rw && grid[row*rw+x]===1;
    if(on && start<0) start=x;
    if((!on || x===rw) && start>=0){
      const end=x;
      const width=(end-start)/rw*w;
      if(width>=12){
        const center=(start+end)/2/rw*w+earthShiftDeg/360*w;
        for(const cx of [center-w,center,center+w]){
          if(cx>-60&&cx<w+60){
            ctx.save();
            const scale=Math.max(1,Math.sqrt(state.zoom));
            ctx.font=`800 ${9/scale}px system-ui,sans-serif`;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillStyle='rgba(255,205,118,.95)';
            ctx.shadowColor='rgba(0,0,0,.95)';
            ctx.shadowBlur=5/scale;
            ctx.fillText('GANDANTA',cx,h*.34);
            ctx.restore();
          }
        }
      }
      start=-1;
    }
  }
}

function drawFocusOverlay(w,h,earthShiftDeg){
  const hasSign=state.focusSign!==null;
  const hasNak=state.focusNak!==null;
  if(!hasSign && !hasNak) return;
  if(!state.risingSignGrid || !state.risingNakGrid) return;

  const rw=focusCanvas.width;
  const rh=focusCanvas.height;
  const source=hasSign?state.risingSignGrid:state.risingNakGrid;
  const target=hasSign?state.focusSign:state.focusNak;
  const img=focusCtx.createImageData(rw,rh);
  const data=img.data;
  const baseColor=hasSign
    ? hexToRgb(SIGNS[target][2])
    : hslToRgb(target/27,.72,.58);

  for(let i=0;i<source.length;i++){
    if(source[i]!==target) continue;
    const p=i*4;
    data[p]=baseColor[0];
    data[p+1]=baseColor[1];
    data[p+2]=baseColor[2];
    data[p+3]=150;
  }
  focusCtx.putImageData(img,0,0);

  ctx.save();
  ctx.fillStyle='rgba(2,8,18,.50)';
  ctx.fillRect(0,0,w,h);
  ctx.restore();

  drawWrappedCanvas(focusCanvas,w,h,earthShiftDeg);
  drawFocusContour(source,target,w,h,baseColor,earthShiftDeg);
}

function drawFocusContour(grid,target,w,h,color,earthShiftDeg){
  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  const left=[];
  const right=[];

  for(let y=0;y<rh;y++){
    let first=-1,last=-1;
    for(let x=0;x<rw;x++){
      if(grid[y*rw+x]===target){
        if(first<0) first=x;
        last=x;
      }
    }
    if(first>=0){
      const shiftPx=earthShiftDeg/360*w;
      left.push({x:first/rw*w+shiftPx,y:y/rh*h});
      right.push({x:(last+1)/rw*w+shiftPx,y:y/rh*h});
    }
  }

  const stroke=`rgba(${color[0]},${color[1]},${color[2]},.95)`;
  [left,right].forEach(points=>{
    if(points.length<2) return;
    for(const copy of [-1,0,1]){
      const dx=copy*w;
      ctx.save();
      ctx.strokeStyle=stroke;
      ctx.lineWidth=2.2;
      ctx.lineJoin='round';
      ctx.lineCap='round';
      ctx.beginPath();

      let prev=null;
      for(const raw of points){
        const p={x:raw.x+dx,y:raw.y};
        if(!prev || Math.abs(p.x-prev.x)>w*.3){
          ctx.moveTo(p.x,p.y);
        }else{
          const mx=(prev.x+p.x)/2;
          const my=(prev.y+p.y)/2;
          ctx.quadraticCurveTo(prev.x,prev.y,mx,my);
        }
        prev=p;
      }
      ctx.stroke();
      ctx.restore();
    }
  });
}

function updateFocusSummary(){
  const el=document.getElementById('focusSummary');
  if(state.focusSign!==null){
    const planets=state.astro?.placements?.filter(p=>Math.floor(normalize360(p.lon)/30)===state.focusSign)||[];
    el.textContent=`${SIGNS[state.focusSign][1]} ${SIGNS[state.focusSign][0]} highlighted · ${planets.length} planet${planets.length===1?'':'s'} in sign`;
  }else if(state.focusNak!==null){
    const planets=state.astro?.placements?.filter(p=>Math.floor(normalize360(p.lon)/NAK_SIZE)===state.focusNak)||[];
    el.textContent=`${NAKSHATRAS[state.focusNak]} highlighted · ${planets.length} planet${planets.length===1?'':'s'} in nakshatra`;
  }else{
    el.textContent='No zone highlighted';
  }
}

function populateFocusControls(){
  const select=document.getElementById('focusNakSelect');
  NAKSHATRAS.forEach((name,i)=>{
    const option=document.createElement('option');
    option.value=String(i);
    option.textContent=name;
    select.appendChild(option);
  });
}

function drawRisingLabels(w,h,showZodiac,showNak,earthShiftDeg){
  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  if(!state.risingSignGrid || !state.risingNakGrid) return;

  if(showZodiac){
    const yFrac=.055;
    const row=Math.max(0,Math.min(rh-1,Math.floor(.12*rh)));
    const seen=new Set();
    drawCenteredRuns(
      state.risingSignGrid,row,12,w,h*yFrac,
      index=>`${SIGNS[index][1]} ${SIGNS[index][0]}`,
      index=>SIGNS[index][2],
      13,26,seen
    );
  }

  if(showNak && w>900){
    const yFrac=.105;
    const row=Math.max(0,Math.min(rh-1,Math.floor(.16*rh)));
    drawCenteredRuns(
      state.risingNakGrid,row,27,w,h*yFrac,
      index=>NAKSHATRAS[index],
      index=>nakColorCss(index),
      8,16,null
    );
  }

  function drawCenteredRuns(grid,row,count,screenW,y,labelFor,colorFor,size,minScreenWidth,seen){
    let start=0;
    let current=grid[row*rw];

    for(let x=1;x<=rw;x++){
      const next=x<rw?grid[row*rw+x]:255;
      if(next!==current){
        const runWidth=(x-start)/rw*screenW;
        if(current<count && runWidth>=minScreenWidth && (!seen || !seen.has(current))){
          const center=(start+x)/2/rw*screenW + earthShiftDeg/360*screenW;
          const candidates=[center-screenW,center,center+screenW].filter(cx=>cx>-80&&cx<screenW+80);
          if(candidates.length){
            const cx=candidates.sort((a,b)=>Math.abs(a-screenW/2)-Math.abs(b-screenW/2))[0];
            drawFieldLabel(labelFor(current),colorFor(current),cx,y,size);
            if(seen)seen.add(current);
          }
        }
        start=x;
        current=next;
      }
    }
  }
}

function drawFieldLabel(text,color,x,y,size){
  const visualScale=Math.max(1,Math.sqrt(state.zoom));
  const localSize=(size+2)/visualScale;

  ctx.save();
  ctx.font=`900 ${localSize}px system-ui,Segoe UI Symbol,sans-serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.lineJoin='round';
  ctx.lineWidth=Math.max(2.2/visualScale,localSize*.20);
  ctx.strokeStyle='rgba(0,0,0,.92)';
  ctx.shadowColor='rgba(0,0,0,.98)';
  ctx.shadowBlur=7/visualScale;
  ctx.strokeText(text,x,y);
  ctx.fillStyle=color;
  ctx.fillText(text,x,y);
  ctx.restore();
}

function degreeLineY(degree,h){
  const d=Math.max(0,Math.min(29,Number(degree)||0));
  const top=h*.15;
  const bottom=h*.93;
  return top+(d/29)*(bottom-top);
}

function drawZodiacDegreeGrid(w,h){
  ctx.save();
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  const scale=Math.max(1,Math.sqrt(state.zoom));
  ctx.font=(8/scale)+'px system-ui,sans-serif';

  for(let d=0;d<30;d++){
    const y=degreeLineY(d,h);
    const major=d%5===0;
    ctx.strokeStyle=major?'rgba(165,205,226,.23)':'rgba(165,205,226,.10)';
    ctx.lineWidth=(major?.8:.45)/scale;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.lineTo(w,y);
    ctx.stroke();

    ctx.fillStyle=major?'rgba(190,220,236,.78)':'rgba(154,188,207,.46)';
    ctx.fillText(d+'°',6,y);
  }
  ctx.restore();
}

function drawProjectedPlanets(w,h,earthShiftDeg){
  if(!state.astro?.placements?.length) return;
  if(!state.risingSignGrid) return;

  const occupied=new Map();

  state.astro.placements.forEach(p=>{
    const lon=normalize360(p.lon);
    const signIndex=Math.floor(lon/30);
    const degree=lon%30;
    const y=degreeLineY(degree,h);
    const row=Math.max(0,Math.min(risingCanvas.height-1,Math.floor(y/h*risingCanvas.height)));
    const run=findCircularFieldRun(state.risingSignGrid,row,risingCanvas.width,signIndex);

    let fieldX;
    if(run){
      fieldX=((run.start+run.length/2)%risingCanvas.width)/risingCanvas.width*w;
    }else{
      const fallbackRow=Math.max(0,Math.min(risingCanvas.height-1,Math.floor(.12*risingCanvas.height)));
      const fallbackRun=findCircularFieldRun(state.risingSignGrid,fallbackRow,risingCanvas.width,signIndex);
      fieldX=fallbackRun
        ? ((fallbackRun.start+fallbackRun.length/2)%risingCanvas.width)/risingCanvas.width*w
        : lon/360*w;
    }

    const xBase=fieldX+earthShiftDeg/360*w;
    const visibleXs=[xBase-w,xBase,xBase+w].filter(x=>x>-100&&x<w+100);
    if(!visibleXs.length)return;

    const targetNak=Math.min(26,Math.floor(lon/NAK_SIZE));
    const matchesFocus=
      state.focusSign===null && state.focusNak===null
        ? true
        : state.focusSign!==null
          ? signIndex===state.focusSign
          : targetNak===state.focusNak;

    const bucket=Math.round(visibleXs[0]/60);
    const slotKey=bucket+':'+Math.round(y/12);
    const slot=occupied.get(slotKey)||0;
    occupied.set(slotKey,slot+1);
    const yOffset=slot*13;

    ctx.save();
    ctx.globalAlpha=matchesFocus?1:.20;
    ctx.font=`${matchesFocus?'900':'700'} ${matchesFocus?18:15}px system-ui,Segoe UI Symbol,sans-serif`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.98)';
    ctx.shadowBlur=matchesFocus?8:3;

    for(const px of visibleXs){
      const label=`${p.glyph} ${degreeInSign(p.lon)}`;
      const tw=ctx.measureText(label).width;
      ctx.fillStyle='rgba(2,8,18,.84)';
      ctx.fillRect(px-tw/2-5,y+yOffset-10,tw+10,20);
      ctx.fillStyle=p.color;
      ctx.fillText(label,px,y+yOffset);
    }
    ctx.restore();
  });
}

function findCircularFieldRun(grid,row,width,target){
  if(!grid)return null;
  let best=null,start=null,length=0;

  for(let i=0;i<width*2;i++){
    const x=i%width;
    const match=grid[row*width+x]===target;
    if(match){
      if(start===null)start=i;
      length++;
      if(length>width)length=width;
      if(!best||length>best.length)best={start,length};
    }else{
      start=null;length=0;
    }
  }

  if(!best)return null;
  return{start:best.start%width,length:Math.min(best.length,width)};
}

function applyObserver(lat,lng){
  const latitude=Number(lat);
  const longitude=Number(lng);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){
    document.getElementById('locationStatus').textContent='Enter valid coordinates';
    return false;
  }

  const clampedLat=Math.max(-89.9,Math.min(89.9,latitude));
  const wrappedLng=normalize180(longitude);
  state.observer={lat:clampedLat,lng:wrappedLng};

  document.getElementById('latitudeInput').value=clampedLat.toFixed(4);
  document.getElementById('longitudeInput').value=wrappedLng.toFixed(4);
  document.getElementById('locationStatus').textContent=
    `${clampedLat.toFixed(4)}°, ${wrappedLng.toFixed(4)}°`;
  draw();
  return true;
}

async function loadPoliticalLabels(){
  const status=document.getElementById('statusText');
  try{
    const [countriesRes,admin1Res,land50Res]=await Promise.all([
      fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson',{cache:'force-cache'}),
      fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson',{cache:'force-cache'}),
      fetch('https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@ca96624a/geojson/ne_50m_land.geojson',{cache:'force-cache'})
    ]);

    if(!countriesRes.ok) throw new Error('Country labels HTTP '+countriesRes.status);
    const countries=await countriesRes.json();

    state.countryRegions=(countries.features||[]).filter(f=>f?.geometry);
    state.countryLabels=state.countryRegions
      .map(f=>featureLabelPoint(f,'country'))
      .filter(Boolean);

    if(admin1Res.ok){
      const admin1=await admin1Res.json();
      const usaCan=(admin1.features||[]).filter(f=>{
        const p=f.properties||{};
        const code=String(
          p.adm0_a3||p.ADM0_A3||p.sov_a3||p.SOV_A3||p.gu_a3||p.GU_A3||''
        ).toUpperCase();
        const admin=String(p.admin||p.ADMIN||p.geonunit||p.GEONUNIT||'').toLowerCase();
        return code==='USA'||code==='CAN'||admin==='united states of america'||admin==='canada';
      });

      state.admin1Regions=usaCan;
      state.admin1Labels=usaCan
        .map(f=>featureLabelPoint(f,'admin1'))
        .filter(Boolean);

      state.admin1Boundaries=extractFeatureLines(usaCan);
    }

    if(land50Res.ok){
      const land50=await land50Res.json();
      state.land50=extractPolygons(land50);
    }

    state.labelsReady=true;
    status.textContent=
      `World loaded · Lahiri sidereal · detailed coastlines · ${state.admin1Labels.length} states/provinces`;
    draw();
  }catch(err){
    console.error('Political labels failed:',err);
    state.labelsReady=false;
  }
}

function featureLabelPoint(feature,type){
  const p=feature.properties||{};
  const name=String(
    p.NAME_EN||p.name_en||p.NAME||p.name||p.ADMIN||p.admin||''
  ).trim();
  if(!name) return null;

  const labelLon=Number(
    p.LABEL_X??p.label_x??p.longitude??p.LONGITUDE
  );
  const labelLat=Number(
    p.LABEL_Y??p.label_y??p.latitude??p.LATITUDE
  );

  let lon=labelLon;
  let lat=labelLat;

  if(!Number.isFinite(lon)||!Number.isFinite(lat)){
    const bbox=feature.bbox;
    if(Array.isArray(bbox)&&bbox.length>=4){
      lon=(Number(bbox[0])+Number(bbox[2]))/2;
      lat=(Number(bbox[1])+Number(bbox[3]))/2;
    }else{
      const point=geometryCenter(feature.geometry);
      if(!point) return null;
      lon=point.lon;
      lat=point.lat;
    }
  }

  const rank=Number(p.LABELRANK??p.labelrank??p.scalerank??p.SCALERANK??5);
  return {name,lon:normalize180(lon),lat,type,rank};
}

function geometryCenter(geometry){
  if(!geometry) return null;
  const coords=[];
  const collect=value=>{
    if(!Array.isArray(value)) return;
    if(value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))){
      coords.push([Number(value[0]),Number(value[1])]);
      return;
    }
    value.forEach(collect);
  };
  collect(geometry.coordinates);
  if(!coords.length) return null;

  let minLon=180,maxLon=-180,minLat=90,maxLat=-90;
  for(const [lon,lat] of coords){
    minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
    minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
  }
  return {lon:(minLon+maxLon)/2,lat:(minLat+maxLat)/2};
}

function drawPoliticalLabels(w,h,earthShiftDeg){
  if(!state.labelsReady) return;

  const countryRankLimit=
    state.zoom<1.8?4:
    state.zoom<3.2?5:
    state.zoom<5?6:9;

  const drawLabel=(item,isAdmin1)=>{
    const xBase=lonToX(item.lon+earthShiftDeg,w);
    const y=latToY(item.lat,h);
    const baseSize=isAdmin1
      ? Math.max(7,Math.min(9,w/170))
      : Math.max(8,Math.min(11,w/125));
    const fontSize=baseSize/Math.max(1,Math.sqrt(state.zoom));

    ctx.save();
    ctx.globalAlpha=isAdmin1?.42:.54;
    ctx.font=`${isAdmin1?'500':'600'} ${fontSize}px system-ui,sans-serif`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle=isAdmin1?'rgba(196,214,224,.68)':'rgba(214,229,238,.76)';
    ctx.shadowColor='rgba(0,0,0,.68)';
    ctx.shadowBlur=2/Math.max(1,Math.sqrt(state.zoom));

    for(const x of wrappedXs(xBase,w)){
      ctx.fillText(item.name,x,y);
    }
    ctx.restore();
  };

  state.countryLabels
    .filter(item=>item.rank<=countryRankLimit)
    .sort((a,b)=>a.rank-b.rank)
    .forEach(item=>drawLabel(item,false));

  if(state.zoom>=2 && w>=620){
    state.admin1Labels.forEach(item=>drawLabel(item,true));
  }
}

function drawObserverMarker(w,h,earthShiftDeg,date){
  if(!state.observer) return;

  const {lat,lng}=state.observer;
  const xBase=lonToX(lng+earthShiftDeg,w);
  const y=latToY(lat,h);
  const aya=lahiriAyanamsa(date);
  const asc=normalize360(tropicalAscendant(date,lat,lng)-aya);
  const signIndex=Math.floor(asc/30);
  const nakIndex=Math.min(26,Math.floor(asc/NAK_SIZE));

  document.getElementById('localSignText').textContent=
    `${SIGNS[signIndex][1]} ${SIGNS[signIndex][0]}`;
  document.getElementById('localNakText').textContent=NAKSHATRAS[nakIndex];
  document.getElementById('localAscText').textContent=fullZodiac(asc);

  ctx.save();
  for(const x of wrappedXs(xBase,w)){
    ctx.beginPath();
    ctx.arc(x,y,8,0,Math.PI*2);
    ctx.fillStyle='rgba(2,8,18,.92)';
    ctx.fill();
    ctx.lineWidth=2;
    ctx.strokeStyle='#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x,y,3.2,0,Math.PI*2);
    ctx.fillStyle=SIGNS[signIndex][2];
    ctx.fill();

    ctx.font='700 11px system-ui,Segoe UI Symbol,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='bottom';
    ctx.fillStyle='#ffffff';
    ctx.shadowColor='rgba(0,0,0,.95)';
    ctx.shadowBlur=5;
    ctx.fillText(`${SIGNS[signIndex][1]} ${NAKSHATRAS[nakIndex]}`,x,y-11);
  }
  ctx.restore();
}

function inspectMapPoint(clientX,clientY){
  if(!state.astro) return;

  const rect=canvas.getBoundingClientRect();
  const screenX=Math.max(0,Math.min(rect.width,clientX-rect.left));
  const screenY=Math.max(0,Math.min(rect.height,clientY-rect.top));
  const point=screenToMapPoint(screenX,screenY,rect.width,rect.height);
  const date=currentDate();
  const phase=normalize360(greenwichSiderealDegrees(date));
  const earthShiftDeg=normalize180(phase+state.panDeg);

  const mapLon=xToLon(point.x,rect.width);
  const lon=normalize180(mapLon-earthShiftDeg);
  const lat=yToLat(point.y,rect.height);

  state.selectedPoint={lat,lon};
  updateLocationReading(lat,lon,date);
  document.getElementById('locationInspectPanel').hidden=false;
  draw();
}

function updateLocationReading(lat,lon,date){
  const aya=lahiriAyanamsa(date);
  const asc=normalize360(tropicalAscendant(date,lat,lon)-aya);
  const signIndex=Math.floor(asc/30);
  const nakIndex=Math.min(26,Math.floor(asc/NAK_SIZE));
  const withinNak=normalize360(asc)%NAK_SIZE;
  const pada=Math.min(4,Math.floor(withinNak/(NAK_SIZE/4))+1);
  const signLord=SIGN_LORDS[signIndex];
  const nakLord=NAK_LORD_SEQUENCE[nakIndex%9];
  const influences=locationInfluences(asc,nakIndex);
  const angles=localAngles(date,lat,lon,aya);
  const houses=buildWholeSignHouses(asc);
  const lordReport=buildRisingLordReport(houses,asc,nakIndex,date);

  document.getElementById('inspectCoords').textContent=
    `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  document.getElementById('inspectAsc').textContent=fullZodiac(asc);
  document.getElementById('inspectSign').textContent=
    `${SIGNS[signIndex][1]} ${SIGNS[signIndex][0]}`;
  document.getElementById('inspectNak').textContent=NAKSHATRAS[nakIndex];
  document.getElementById('inspectPada').textContent=String(pada);
  document.getElementById('inspectSignLord').textContent=signLord;
  document.getElementById('inspectNakLord').textContent=nakLord;

  document.getElementById('inspectAngleAsc').textContent=fullZodiac(angles.asc);
  document.getElementById('inspectAngleDsc').textContent=fullZodiac(angles.dsc);
  document.getElementById('inspectAngleMc').textContent=fullZodiac(angles.mc);
  document.getElementById('inspectAngleIc').textContent=fullZodiac(angles.ic);

  document.getElementById('inspectHouses').innerHTML=houses.map(house=>{
    const planetText=house.planets.length
      ? house.planets.map(p=>`${p.glyph} ${p.name}`).join(', ')
      : '—';
    return `<div class="house-row ${house.angular?'angular-house':''}">
      <span class="house-num">H${house.number}</span>
      <span class="house-sign"><b>${SIGNS[house.sign][1]} ${SIGNS[house.sign][0]}</b><small>${house.lord}</small></span>
      <span class="house-purpose">${house.purpose}</span>
      <span class="house-planets">${planetText}</span>
    </div>`;
  }).join('');

  renderRisingLordReport(lordReport,null);
  updateRisingLordNewsCorrelation(lat,lon,date,lordReport);

  const influenceEl=document.getElementById('inspectInfluences');
  influenceEl.innerHTML=influences.length
    ? influences.map(item=>`<span><b>${item.glyph} ${item.name}</b> · ${item.reason}</span>`).join('')
    : '<span>No close angular contacts to the Ascendant.</span>';

  const occupied=houses.filter(h=>h.planets.length).map(h=>`H${h.number}`).join(', ');
  document.getElementById('inspectSummary').textContent=
    `${SIGNS[signIndex][0]} rises here in ${NAKSHATRAS[nakIndex]} pada ${pada}. `+
    `The sign lord is ${signLord}; the nakshatra lord is ${nakLord}. `+
    `Current planets occupy ${occupied||'no listed houses'} in the local whole-sign chart.`;
}

function renderRisingLordReport(report,correlation){
  const container=document.getElementById('inspectCoreForecast');
  if(!container) return;

  const categorySummary=correlation?.categories?.length
    ? `<div class="breaking-category-summary"><b>Today's breaking-news categories</b><span>${correlation.categories.slice(0,5).map(c=>escapeHtml(c.name)+' ('+c.count+')').join(' · ')}</span></div>`
    : '';

  const observed=correlation
    ? correlation.matches.length
      ? `<div class="observed-events">
          <b>Observed examples for this rising-lord pattern</b>
          ${correlation.matches.slice(0,5).map(m=>`
            <a class="observed-story" href="${escapeAttr(m.article.url)}" target="_blank" rel="noopener noreferrer">
              <span>${escapeHtml(m.article.title)}</span>
              <small>${escapeHtml(m.matchWhy)} · ${formatStoryTime(m.article.publishedAt)}</small>
            </a>`).join('')}
        </div>`
      : `<div class="observed-events empty"><b>Observed examples</b><span>No strong headline match found for this rising-lord signature.</span></div>`
    : `<div class="observed-events loading"><b>Observed examples</b><span>Checking current area news for this rising-lord signature…</span></div>`;

  container.innerHTML=`
    <article class="forecast-card lord-report-card">
      <div class="forecast-card-head">
        <span class="forecast-house">${escapeHtml(report.lordGlyph)}</span>
        <div>
          <b>${escapeHtml(report.risingSign)} rising · ${escapeHtml(report.lordName)} report</b>
          <small>${escapeHtml(report.lordPosition)}</small>
        </div>
        <span class="forecast-balance ${escapeAttr(report.tone.key)}">${escapeHtml(report.tone.label)} · ${report.score>=0?'+':''}${report.score.toFixed(1)}</span>
      </div>
      <p class="lord-summary">${escapeHtml(report.summary)}</p>
      <div class="aspect-report-list">
        ${report.interpretations.map(item=>`
          <section class="aspect-report-item ${escapeAttr(item.kind)}">
            <b>${escapeHtml(item.heading)}</b>
            <p>${escapeHtml(item.text)}</p>
            <small>${escapeHtml(item.evidence)}</small>
          </section>`).join('')}
      </div>
      ${report.learnedText?`<div class="learning-note"><b>Pattern memory</b><span>${escapeHtml(report.learnedText)}</span></div>`:''}
      ${categorySummary}
      ${observed}
    </article>`;
}

async function updateRisingLordNewsCorrelation(lat,lon,date,report){
  const status=document.getElementById('inspectNewsStatus');
  if(!status) return;

  const area=resolvePoliticalArea(lat,lon);
  if(!area){
    status.textContent='Area could not be resolved for news comparison';
    renderRisingLordReport(report,{matches:[]});
    return;
  }

  const now=new Date();
  const sameCalendarDay=
    now.getFullYear()===date.getFullYear() &&
    now.getMonth()===date.getMonth() &&
    now.getDate()===date.getDate();
  if(!sameCalendarDay){
    status.textContent=`${area.label} · breaking-news comparison only runs for today's chart`;
    renderRisingLordReport(report,{matches:[],categories:[]});
    return;
  }

  const seq=++state.newsSeq;
  status.textContent=`${area.label} · checking headlines against ${report.lordName} pattern…`;

  try{
    const articles=await fetchAreaNews(area.query);
    if(seq!==state.newsSeq) return;

    const correlation=correlateNewsToRisingLord(articles,report,date);
    rememberRisingLordMatches(report,correlation.matches);
    report.learnedText=describeLearnedPattern(report.signature);
    renderRisingLordReport(report,correlation);

    status.textContent=
      `${area.label} · ${correlation.matches.length} rising-lord match${correlation.matches.length===1?'':'es'} from today's breaking headlines`;
  }catch(err){
    console.error('Rising-lord news correlation failed:',err);
    if(seq!==state.newsSeq) return;
    status.textContent=`${area.label} · live news unavailable`;
    renderRisingLordReport(report,{matches:[]});
  }
}

function correlateNewsToRisingLord(articles,report,chartDate){
  const matches=[];
  const categoryMap=new Map();

  for(const article of articles){
    if(!isSameCalendarDay(article.publishedAt,chartDate)) continue;

    const classified=classifyNewsEvent(article);
    let score=0;
    const reasons=[];

    for(const signal of report.signalPlanets){
      const hit=classified.planetScores.find(x=>x.name===signal);
      if(hit){
        score+=hit.score;
        reasons.push(signal);
      }
    }

    for(const h of report.signalHouses){
      const hs=classified.houseScores.get(h)||0;
      if(hs>0){
        score+=hs*.7;
        reasons.push('H'+h);
      }
    }

    score+=classified.breakingScore*.35;

    for(const category of classified.categories){
      categoryMap.set(category,(categoryMap.get(category)||0)+1);
    }

    if(score>=1.7){
      matches.push({
        article,
        score,
        category:classified.categories[0]||'General breaking news',
        matchWhy:`${classified.categories[0]||'Breaking news'} · ${report.lordName} signature → ${[...new Set(reasons)].slice(0,4).join(' + ')}`
      });
    }
  }

  matches.sort((a,b)=>b.score-a.score);
  const categories=[...categoryMap.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([name,count])=>({name,count}));

  return {matches,categories};
}

function isSameCalendarDay(value,referenceDate){
  const d=new Date(value);
  if(!Number.isFinite(d.getTime())) return false;
  return d.getFullYear()===referenceDate.getFullYear() &&
    d.getMonth()===referenceDate.getMonth() &&
    d.getDate()===referenceDate.getDate();
}

function rememberRisingLordMatches(report,matches){
  if(!matches.length) return;
  try{
    const raw=localStorage.getItem('risingLordPatternMemory');
    const memory=raw?JSON.parse(raw):{};
    const row=memory[report.signature]||{count:0,terms:{}};
    row.count+=matches.length;

    for(const m of matches.slice(0,5)){
      const c=classifyNewsEvent(m.article);
      for(const p of c.planetScores.slice(0,4)){
        row.terms[p.name]=(row.terms[p.name]||0)+1;
      }
      for(const [house,val] of c.houseScores){
        if(val>0) row.terms['H'+house]=(row.terms['H'+house]||0)+1;
      }
    }

    memory[report.signature]=row;
    const entries=Object.entries(memory)
      .sort((a,b)=>(b[1].count||0)-(a[1].count||0))
      .slice(0,120);
    localStorage.setItem('risingLordPatternMemory',JSON.stringify(Object.fromEntries(entries)));
  }catch{}
}

function describeLearnedPattern(signature){
  try{
    const raw=localStorage.getItem('risingLordPatternMemory');
    if(!raw) return '';
    const row=JSON.parse(raw)[signature];
    if(!row||row.count<2) return '';
    const top=Object.entries(row.terms||{}).sort((a,b)=>b[1]-a[1]).slice(0,4);
    if(!top.length) return '';
    return `Across ${row.count} saved headline matches for this aspect signature, recurring themes include ${top.map(([k,v])=>k+' ('+v+')').join(', ')}. This is pattern memory, not proof of causation.`;
  }catch{return ''}
}

async function fetchAreaNews(areaQuery){
  const key=areaQuery.toLowerCase();
  const cached=state.newsCache.get(key);
  if(cached && Date.now()-cached.stamp<300000) return cached.articles;

  const r=await fetch('/api/news?q='+encodeURIComponent(areaQuery),{cache:'no-store'});
  if(!r.ok) throw new Error('Area news HTTP '+r.status);
  const data=await r.json();
  const articles=Array.isArray(data.articles)?data.articles:[];
  state.newsCache.set(key,{stamp:Date.now(),articles});
  return articles;
}

function classifyNewsEvent(article){
  const text=`${article.title||''} ${article.description||''}`.toLowerCase();
  const houseRules={
    1:[
      ['residents',1.2],['community',1.2],['public health',1.4],['health',.8],
      ['population',1.2],['local emergency',1.4],['citywide',1.1],['statewide',1.1],
      ['opening',.8],['launch',.8],['begins',.6]
    ],
    3:[
      ['road',1.2],['traffic',1.4],['crash',1.5],['train',1.3],['transit',1.4],
      ['bus',1.1],['communication',1.3],['internet',1.2],['phone',1.0],
      ['neighborhood',1.4],['neighbors',1.4],['delivery',.9],['mail',.9],
      ['school district',.8],['local travel',1.4]
    ],
    7:[
      ['agreement',1.5],['deal',1.1],['partnership',1.4],['lawsuit',1.5],
      ['court',1.2],['hearing',1.1],['negotiation',1.4],['settlement',1.4],
      ['dispute',1.3],['conflict',1.0],['meeting',.9],['contract',1.3],
      ['diplomatic',1.2]
    ],
    9:[
      ['university',1.3],['college',1.2],['international',1.4],['foreign',1.2],
      ['airline',1.2],['airport',1.1],['long-distance',1.5],['travel',.9],
      ['religion',1.2],['church',.8],['temple',.8],['law',.9],
      ['education',1.0],['research',1.0],['professor',1.0],['tourism',1.0]
    ]
  };
  const breakingCategories={
    'Accidents / Conflict':[
      ['crash',2],['shooting',2],['attack',2],['explosion',2],['fire',1.5],['injury',1.2],['war',1.5],['military',1.2]
    ],
    'Weather / Disaster':[
      ['earthquake',2],['hurricane',2],['flood',1.8],['wildfire',1.8],['tornado',2],['storm',1.3],['volcano',2],['evacuation',1.5]
    ],
    'Government / Legal':[
      ['government',1.2],['mayor',1.2],['governor',1.2],['court',1.4],['lawsuit',1.5],['hearing',1.2],['law',1.0],['police',1.0]
    ],
    'Infrastructure / Transport':[
      ['road',1.3],['traffic',1.3],['transit',1.4],['train',1.4],['airport',1.3],['airline',1.2],['bridge',1.3],['outage',1.5],['infrastructure',1.5]
    ],
    'Business / Markets':[
      ['business',1.0],['market',1.2],['finance',1.2],['bank',1.2],['company',.9],['jobs',1.0],['layoff',1.3],['strike',1.2]
    ],
    'Public Safety / Health':[
      ['emergency',1.4],['hospital',1.2],['health',1.1],['public safety',1.5],['warning',1.2],['shelter',1.0],['missing',1.2]
    ],
    'Education / Institutions':[
      ['university',1.3],['college',1.2],['school',1.0],['research',1.1],['professor',1.0],['institution',1.0]
    ],
    'Technology / Communications':[
      ['internet',1.4],['cyber',1.5],['technology',1.2],['data',1.0],['phone',1.0],['communications',1.2],['ai ',1.0]
    ]
  };
  const planetRules={
    Sun:[['mayor',1.3],['governor',1.3],['president',1.3],['authority',1],['government',1],['leader',1]],
    Moon:[['family',1],['children',.9],['water',1],['flood',1.2],['public',.7],['housing',.8]],
    Mercury:[['internet',1.3],['communication',1.3],['data',1],['technology',1],['traffic',.9],['transit',.9],['business',.8],['report',.7]],
    Venus:[['agreement',1.2],['arts',1],['music',1],['finance',.9],['market',.8],['relationship',1],['festival',.8]],
    Mars:[['fire',1.3],['crash',1.4],['shooting',1.5],['attack',1.4],['military',1.2],['injury',1.1],['explosion',1.4],['police',.8]],
    Jupiter:[['university',1.2],['education',1.1],['court',.9],['judge',1],['law',1],['religion',1],['growth',.8],['expansion',.8]],
    Saturn:[['delay',1.3],['closure',1.2],['restriction',1.3],['infrastructure',1.2],['labor',1],['strike',1.2],['construction',.9],['shortage',1]],
    Rahu:[['unusual',1],['scandal',1.2],['cyber',1.3],['ai ',1],['foreign',.9],['surge',.9],['record',.7]],
    Ketu:[['outage',1.3],['shutdown',1.3],['separation',1],['cancellation',1.1],['technical',.9],['disconnect',1.1]]
  };

  const houseScores=new Map();
  const houseReasons=new Map();
  for(const [house,rules] of Object.entries(houseRules)){
    let score=0;
    const reasons=[];
    for(const [term,weight] of rules){
      if(text.includes(term)){
        score+=weight;
        reasons.push(term);
      }
    }
    if(score>0){
      houseScores.set(Number(house),score);
      houseReasons.set(Number(house),reasons);
    }
  }

  const planetScores=[];
  for(const [name,rules] of Object.entries(planetRules)){
    let score=0;
    for(const [term,weight] of rules){
      if(text.includes(term)) score+=weight;
    }
    if(score>0) planetScores.push({name,score});
  }

  const categories=[];
  let breakingScore=0;
  for(const [category,rules] of Object.entries(breakingCategories)){
    let score=0;
    for(const [term,weight] of rules){
      if(text.includes(term)) score+=weight;
    }
    if(score>0){
      categories.push({name:category,score});
      breakingScore=Math.max(breakingScore,score);
    }
  }
  categories.sort((a,b)=>b.score-a.score);

  return {
    houseScores,
    houseReasons,
    planetScores,
    categories:categories.map(x=>x.name),
    breakingScore
  };
}

function forecastSignalPlanets(item){
  const names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Rahu','Ketu'];
  const text=item.reasons.map(r=>r.text).join(' ');
  return new Set(names.filter(name=>text.includes(name)));
}

function resolvePoliticalArea(lat,lon){
  for(const f of state.admin1Regions){
    if(pointInGeometry(lon,lat,f.geometry)){
      const p=f.properties||{};
      const name=String(p.name_en||p.NAME_EN||p.name||p.NAME||'').trim();
      const country=String(p.admin||p.ADMIN||'').trim();
      if(name) return {label:country?`${name}, ${country}`:name,query:country?`${name} ${country}`:name};
    }
  }

  for(const f of state.countryRegions){
    if(pointInGeometry(lon,lat,f.geometry)){
      const p=f.properties||{};
      const name=String(p.NAME_EN||p.name_en||p.ADMIN||p.admin||p.NAME||p.name||'').trim();
      if(name) return {label:name,query:name};
    }
  }
  return null;
}

function pointInGeometry(lon,lat,geometry){
  if(!geometry) return false;
  if(geometry.type==='Polygon') return pointInPolygonCoordinates(lon,lat,geometry.coordinates);
  if(geometry.type==='MultiPolygon') return geometry.coordinates.some(poly=>pointInPolygonCoordinates(lon,lat,poly));
  return false;
}

function pointInPolygonCoordinates(lon,lat,rings){
  if(!rings?.length || !pointInRing(lon,lat,rings[0])) return false;
  for(let i=1;i<rings.length;i++){
    if(pointInRing(lon,lat,rings[i])) return false;
  }
  return true;
}

function pointInRing(lon,lat,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    let xi=ring[i][0], yi=ring[i][1];
    let xj=ring[j][0], yj=ring[j][1];

    // Normalize rings crossing the date line around the tested longitude.
    while(xi-lon>180) xi-=360;
    while(xi-lon<-180) xi+=360;
    while(xj-lon>180) xj-=360;
    while(xj-lon<-180) xj+=360;

    const intersects=((yi>lat)!==(yj>lat)) &&
      (lon < (xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
    if(intersects) inside=!inside;
  }
  return inside;
}

function formatStoryTime(value){
  const d=new Date(value);
  if(!Number.isFinite(d.getTime())) return 'recent';
  return d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

function escapeHtml(value){
  return String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escapeAttr(value){
  return escapeHtml(value).replace(/`/g,'&#96;');
}

function localAngles(date,lat,lon,aya){
  const asc=normalize360(tropicalAscendant(date,lat,lon)-aya);
  const dsc=normalize360(asc+180);
  const lst=normalize360(greenwichSiderealDegrees(date)+lon);
  const eps=rad(meanObliquityFromDate(date));
  const theta=rad(lst);

  const mcTropical=normalize360(
    Math.atan2(Math.sin(theta)*Math.cos(eps),Math.cos(theta))*180/Math.PI
  );
  const mc=normalize360(mcTropical-aya);
  const ic=normalize360(mc+180);

  return {asc,dsc,mc,ic};
}

function buildWholeSignHouses(asc){
  const ascSign=Math.floor(normalize360(asc)/30);
  const purposes=['Dharma','Artha','Kama','Moksha','Dharma','Artha','Kama','Moksha','Dharma','Artha','Kama','Moksha'];

  return Array.from({length:12},(_,i)=>{
    const sign=(ascSign+i)%12;
    const planets=(state.astro?.placements||[]).filter(p=>Math.floor(normalize360(p.lon)/30)===sign);
    return {
      number:i+1,
      sign,
      lord:SIGN_LORDS[sign],
      purpose:purposes[i],
      angular:[1,4,7,10].includes(i+1),
      planets
    };
  });
}

function buildRisingLordReport(houses,asc,nakIndex,date){
  const ascSign=Math.floor(normalize360(asc)/30);
  const lordName=SIGN_LORDS[ascSign];
  const lord=findPlacement(lordName);
  const interpretations=[];
  const signalPlanets=new Set([lordName]);
  const signalHouses=new Set([1]);
  let score=0;

  if(!lord){
    return {
      risingSign:SIGNS[ascSign][0],lordName,lordGlyph:'',lordPosition:'Unavailable',
      score:0,tone:forecastTone(0),summary:'The rising-sign lord could not be calculated.',
      interpretations:[],signature:lordName+'-missing',signalPlanets:[],signalHouses:[1],learnedText:''
    };
  }

  const lordHouse=planetHouseNumber(lord.lon,houses);
  const lordSign=Math.floor(normalize360(lord.lon)/30);
  const lordNak=Math.min(26,Math.floor(normalize360(lord.lon)/NAK_SIZE));
  const dignity=planetDignity(lord);
  score+=dignity.score+housePlacementScore(lordHouse);
  signalHouses.add(lordHouse);

  interpretations.push({
    kind:dignity.score>0?'positive':dignity.score<0?'negative':'neutral',
    heading:`${lordName} sets the local storyline`,
    text:interpretLordPlacement(lordName,lordHouse,lordSign,dignity,date),
    evidence:`${lordName} in H${lordHouse} · ${SIGNS[lordSign][0]} · ${NAKSHATRAS[lordNak]} · ${dignity.label}`
  });

  const incoming=aspectsToPlanet(lord,houses);
  const outgoing=aspectsFromPlanet(lord,houses);

  for(const a of incoming){
    signalPlanets.add(a.planet.name);
    signalHouses.add(a.fromHouse);
    const val=planetNatureScore(a.planet.name)*.9;
    score+=val;
    interpretations.push({
      kind:val>0?'positive':val<0?'negative':'caution',
      heading:`${a.planet.name} → ${lordName}`,
      text:interpretPlanetToLordAspect(a.planet.name,lordName,a.aspectNumber,lordHouse),
      evidence:`${a.planet.name} in H${a.fromHouse} casts its ${ordinal(a.aspectNumber)} aspect to the house containing ${lordName}`
    });
  }

  for(const a of outgoing){
    signalHouses.add(a.targetHouse);
    const val=planetNatureScore(lordName)*.35;
    score+=val;
    interpretations.push({
      kind:val>0?'positive':val<0?'negative':'neutral',
      heading:`${lordName} → H${a.targetHouse}`,
      text:interpretLordOutgoingAspect(lordName,a.targetHouse,a.aspectNumber,houses[a.targetHouse-1]),
      evidence:`${lordName} casts its ${ordinal(a.aspectNumber)} aspect from H${lordHouse} to H${a.targetHouse}`
    });
  }

  for(const c of closeConjunctions(lord,8)){
    signalPlanets.add(c.planet.name);
    const val=planetNatureScore(c.planet.name)*conjunctionStrength(c.diff);
    score+=val;
    interpretations.push({
      kind:val>0?'positive':val<0?'negative':'caution',
      heading:`${lordName} conjunct ${c.planet.name}`,
      text:interpretConjunctionWithLord(lordName,c.planet.name,c.diff,lordHouse),
      evidence:`${c.diff.toFixed(1)}° separation in H${lordHouse}`
    });
  }

  if(isCombust(lord)){
    score-=1.25;
    interpretations.push({
      kind:'negative',
      heading:`${lordName} combust`,
      text:`${lordName}'s agenda can become harder to express cleanly because its functions are closely merged with solar authority, visibility, urgency, or ego demands. Events may center on being seen, approved, directed, or overpowered.`,
      evidence:'Within configured combustion threshold of the Sun'
    });
    signalPlanets.add('Sun');
  }

  if(isPlanetRetrograde(lordName,date)){
    interpretations.push({
      kind:'caution',
      heading:`${lordName} retrograde`,
      text:`The rising lord is operating in a revisional mode. Matters ruled by ${lordName} may repeat, return, require correction, or develop through reconsideration rather than a straight line.`,
      evidence:'Geocentric longitude decreases across the surrounding 12-hour check'
    });
  }

  if(isGandanta(lord.lon)){
    score-=.75;
    interpretations.push({
      kind:'caution',
      heading:`${lordName} in gandanta`,
      text:`The rising lord sits in a water-to-fire transition zone, so the local storyline can feel transitional: endings and beginnings may overlap, with incomplete conditions forcing a change of state.`,
      evidence:'Strict ±0°48′ gandanta zone'
    });
  }

  const signature=[
    lordName,
    'H'+lordHouse,
    ...incoming.map(a=>a.planet.name+'>'+lordName+':'+a.aspectNumber),
    ...outgoing.map(a=>lordName+'>H'+a.targetHouse+':'+a.aspectNumber),
    ...closeConjunctions(lord,8).map(c=>lordName+'+'+c.planet.name)
  ].sort().join('|');

  const tone=forecastTone(score);
  const learnedText=describeLearnedPattern(signature);
  const summary=composeRisingLordSummary(lordName,lordHouse,lordSign,tone,incoming,outgoing,interpretations,nakIndex);

  return {
    risingSign:SIGNS[ascSign][0],
    lordName,
    lordGlyph:lord.glyph||'',
    lordPosition:`${fullZodiac(lord.lon)} · H${lordHouse} · ${NAKSHATRAS[lordNak]}`,
    score,tone,summary,interpretations,
    signature,
    signalPlanets:[...signalPlanets],
    signalHouses:[...signalHouses],
    learnedText
  };
}

function aspectsToPlanet(target,houses){
  const targetHouse=planetHouseNumber(target.lon,houses);
  const out=[];
  for(const p of (state.astro?.placements||[])){
    if(p===target||!CLASSICAL_GRAHAS.has(p.name)) continue;
    const fromHouse=planetHouseNumber(p.lon,houses);
    if(!fromHouse) continue;
    const offset=(targetHouse-fromHouse+12)%12;
    if(fullAspectOffsets(p.name).includes(offset)){
      out.push({planet:p,fromHouse,targetHouse,aspectNumber:offset+1});
    }
  }
  return out;
}

function aspectsFromPlanet(planet,houses){
  const fromHouse=planetHouseNumber(planet.lon,houses);
  return fullAspectOffsets(planet.name).map(offset=>({
    targetHouse:((fromHouse-1+offset)%12)+1,
    aspectNumber:offset+1
  }));
}

function interpretLordPlacement(lordName,house,sign,dignity,date){
  const houseThemes={
    1:'identity, visibility, body, initiative and immediate conditions',
    2:'money, resources, speech, food and stored value',
    3:'short travel, communication, neighbors, courage and local movement',
    4:'home, land, shelter, emotional security and private conditions',
    5:'creativity, recreation, children, learning and speculation',
    6:'workload, service, health routines, disputes and obstacles',
    7:'other people, contracts, meetings, partners and open opposition',
    8:'disruption, hidden matters, vulnerability, shared resources and transformation',
    9:'long travel, teachers, law, belief, higher learning and guidance',
    10:'career, government, public action, reputation and responsibility',
    11:'gains, networks, income, alliances and large groups',
    12:'expense, withdrawal, foreign settings, isolation and release'
  };
  const dignityText=dignity.score>0?'has structural support':dignity.score<0?'is under strain':'is operating without a strong dignity advantage';
  return `Because ${lordName} rules the current Ascendant, its condition describes the main local storyline. In H${house}, attention concentrates on ${houseThemes[house]}. In ${SIGNS[sign][0]}, ${lordName} ${dignityText}. Predictions should therefore begin with how ${lordName}'s agenda is expressed through these H${house} topics rather than treating every house equally.`;
}

function interpretPlanetToLordAspect(source,lord,aspectNumber,lordHouse){
  const effects={
    Sun:'authority, visibility, leadership, government, status or ego pressure',
    Moon:'public mood, movement, care, family needs, housing or emotional response',
    Mars:'speed, conflict, heat, machinery, accidents, competition or decisive action',
    Mercury:'messages, traffic, trade, paperwork, technology, negotiation or information',
    Jupiter:'expansion, law, education, advice, institutions, opportunity or excess',
    Venus:'agreements, money, comfort, arts, attraction, social cooperation or pleasure',
    Saturn:'delay, duty, infrastructure, labor, restriction, endurance or institutional pressure',
    Rahu:'amplification, novelty, foreign influence, technology, controversy or irregular behavior',
    Ketu:'separation, shutdown, technical focus, simplification, detachment or abrupt disengagement'
  };
  const tone=planetNatureScore(source)>0?'supports and enlarges':planetNatureScore(source)<0?'pressurizes and complicates':'modifies';
  return `${source}'s ${ordinal(aspectNumber)} aspect ${tone} the rising lord's agenda through ${effects[source]||'its natural significations'}. Because it lands on the house containing ${lord}, those themes become part of the main event stream rather than a secondary background influence.`;
}

function interpretLordOutgoingAspect(lord,targetHouse,aspectNumber,target){
  const topics={
    1:'self and immediate conditions',2:'money and speech',3:'local travel and communications',
    4:'home and property',5:'creativity, children and recreation',6:'work, health and disputes',
    7:'meetings, contracts and other people',8:'disruption and shared resources',
    9:'long travel, law and guidance',10:'career, government and public action',
    11:'gains, networks and income',12:'expense, withdrawal and foreign settings'
  };
  return `The rising lord actively projects its agenda into H${targetHouse}, bringing ${lord}'s style into ${topics[targetHouse]}. This is a likely destination for events: developments centered on ${topics[targetHouse]} can become a visible expression of the current rising-sign lord.`;
}

function interpretConjunctionWithLord(lord,other,diff,house){
  const closeness=diff<=1?'very tightly':diff<=3?'tightly':diff<=6?'moderately':'loosely';
  return `${other} is ${closeness} joined to the rising lord in H${house}, so their significations operate as one combined event mechanism. Interpretations should blend ${lord}'s local agenda with ${other}'s concrete themes instead of reading either planet separately.`;
}

function composeRisingLordSummary(lordName,lordHouse,lordSign,tone,incoming,outgoing,items,nakIndex){
  const incomingText=incoming.length
    ? `It receives full aspects from ${incoming.map(a=>a.planet.name).join(', ')}.`
    : 'It receives no configured full classical graha aspects.';
  const outgoingText=outgoing.length
    ? `It projects full aspects toward H${outgoing.map(a=>a.targetHouse).join(', H')}.`
    : 'It has no additional configured full-aspect destinations beyond conjunctions.';
  return `${lordName}, ruler of the current rising sign, is the sole anchor of this report. It is in ${SIGNS[lordSign][0]} and H${lordHouse}. ${incomingText} ${outgoingText} The combined pattern is ${tone.description}. The Ascendant remains in ${NAKSHATRAS[nakIndex]}, providing the local nakshatra context.`;
}

function forecastTone(score){
  if(score>=3) return {key:'strong-support',label:'Strong support',description:'strongly supportive within this rule set'};
  if(score>=1) return {key:'support',label:'Support',description:'supportive overall, with some qualifications'};
  if(score<=-3) return {key:'high-pressure',label:'High pressure',description:'strongly pressurized within this rule set'};
  if(score<=-1) return {key:'pressure',label:'Pressure',description:'pressurized overall, with some counterweights'};
  return {key:'mixed',label:'Mixed',description:'mixed, without a dominant positive or difficult signal'};
}

function findPlacement(name){
  return (state.astro?.placements||[]).find(p=>p.name===name)||null;
}

function planetNatureScore(name){
  const scores={
    Jupiter:1.6,Venus:1.5,Mercury:.65,Moon:.7,
    Sun:-.25,Mars:-1.15,Saturn:-1.35,Rahu:-1.25,Ketu:-1.1
  };
  return scores[name]||0;
}

function planetDignity(planet){
  if(!planet||!OWN_SIGNS[planet.name]) return {label:'no classical dignity score',score:0};
  const sign=Math.floor(normalize360(planet.lon)/30);
  if(EXALTATION_SIGNS[planet.name]===sign) return {label:'exalted sign',score:2.2};
  if(DEBILITATION_SIGNS[planet.name]===sign) return {label:'debilitated sign',score:-2.2};
  if(OWN_SIGNS[planet.name].includes(sign)) return {label:'own sign',score:1.6};

  const signLord=SIGN_LORDS[sign];
  const rel=naturalRelationship(planet.name,signLord);
  if(rel==='friend') return {label:`friend's sign (${signLord})`,score:.7};
  if(rel==='enemy') return {label:`enemy's sign (${signLord})`,score:-.7};
  return {label:`neutral sign (${signLord})`,score:0};
}

function naturalRelationship(a,b){
  if(a===b) return 'self';
  const r=NATURAL_RELATIONS[a];
  if(!r) return 'neutral';
  if(r.friends.includes(b)) return 'friend';
  if(r.enemies.includes(b)) return 'enemy';
  return 'neutral';
}

function compoundPlanetaryRelationship(a,b,aPlanet,bPlanet){
  if(a===b) return {label:'the same graha',score:1};
  const natural=naturalRelationship(a,b);
  const aSign=Math.floor(normalize360(aPlanet.lon)/30);
  const bSign=Math.floor(normalize360(bPlanet.lon)/30);
  const distance=((bSign-aSign+12)%12)+1;
  const temporaryFriend=[2,3,4,10,11,12].includes(distance);
  const naturalScore=natural==='friend'?1:natural==='enemy'?-1:0;
  const total=naturalScore+(temporaryFriend?1:-1);
  if(total>=2) return {label:'very friendly',score:2};
  if(total===1) return {label:'friendly',score:1};
  if(total===0) return {label:'neutral',score:0};
  if(total===-1) return {label:'inimical',score:-1};
  return {label:'strongly inimical',score:-2};
}

function housePlacementScore(houseNumber){
  let score=0;
  if([1,4,7,10].includes(houseNumber)) score+=.8;
  if([1,5,9].includes(houseNumber)) score+=.9;
  if([6,8,12].includes(houseNumber)) score-=1;
  if([3,6,10,11].includes(houseNumber)) score+=.2;
  return score;
}

function fullAspectOffsets(name){
  if(name==='Mars') return [3,6,7];
  if(name==='Jupiter') return [4,6,8];
  if(name==='Saturn') return [2,6,9];
  if(['Sun','Moon','Mercury','Venus','Rahu','Ketu'].includes(name)) return [6];
  return [];
}

function fullAspectsToHouse(targetHouse,houses){
  const out=[];
  for(const p of (state.astro?.placements||[])){
    if(!CLASSICAL_GRAHAS.has(p.name)) continue;
    const from=planetHouseNumber(p.lon,houses);
    if(!from) continue;
    const offset=(targetHouse-from+12)%12;
    if(fullAspectOffsets(p.name).includes(offset)){
      const count=offset+1;
      out.push({planet:p,aspectName:ordinal(count)});
    }
  }
  return out;
}

function ordinal(n){
  const m=n%100;
  if(m>=11&&m<=13) return n+'th';
  return n+({1:'st',2:'nd',3:'rd'}[n%10]||'th');
}

function closeConjunctions(planet,orb=8){
  if(!planet) return [];
  return (state.astro?.placements||[])
    .filter(p=>p!==planet && CLASSICAL_GRAHAS.has(p.name))
    .map(p=>({planet:p,diff:Math.abs(normalize180(normalize360(p.lon)-normalize360(planet.lon)))}))
    .filter(x=>x.diff<=orb)
    .sort((a,b)=>a.diff-b.diff);
}

function conjunctionStrength(diff){
  if(diff<=1) return 1.5;
  if(diff<=3) return 1.2;
  if(diff<=6) return .9;
  return .6;
}

function isCombust(planet){
  if(!planet||!COMBUSTION_ORBS[planet.name]) return false;
  const sun=findPlacement('Sun');
  if(!sun) return false;
  const diff=Math.abs(normalize180(normalize360(planet.lon)-normalize360(sun.lon)));
  return diff<=COMBUSTION_ORBS[planet.name];
}

function isPlanetRetrograde(name,date){
  if(name==='Rahu'||name==='Ketu') return true;
  if(name==='Sun'||name==='Moon') return false;
  const meta=PLANETS.find(p=>p[0]===name);
  if(!meta||!A) return false;
  try{
    const body=A.Body?.[meta[1]];
    if(body===undefined||body===null) return false;
    const before=new Date(date.getTime()-6*3600000);
    const after=new Date(date.getTime()+6*3600000);
    const lonBefore=rawSiderealBodyLongitude(body,before);
    const lonAfter=rawSiderealBodyLongitude(body,after);
    return normalize180(lonAfter-lonBefore)<0;
  }catch{
    return false;
  }
}

function rawSiderealBodyLongitude(body,date){
  const vec=A.GeoVector(body,date,true);
  const ecl=A.Ecliptic(vec);
  return normalize360(Number(ecl.elon)-lahiriAyanamsa(date));
}

function isGandanta(lon){
  const x=normalize360(lon);
  const junctions=[0,120,240];
  return junctions.some(j=>Math.abs(normalize180(x-j))<=.8);
}

function dispositorOf(planet){
  if(!planet) return null;
  const sign=Math.floor(normalize360(planet.lon)/30);
  return findPlacement(SIGN_LORDS[sign]);
}

function bhavatBhavamHouse(houseNumber){
  return ((2*houseNumber-2)%12)+1;
}

function planetHouseNumber(lon,houses){
  const sign=Math.floor(normalize360(lon)/30);
  const index=houses.findIndex(h=>h.sign===sign);
  return index>=0?index+1:null;
}

function locationInfluences(asc,nakIndex){
  if(!state.astro?.placements) return [];

  return state.astro.placements
    .map(p=>{
      const lon=normalize360(p.lon);
      const diff=Math.abs(normalize180(lon-asc));
      const pNak=Math.min(26,Math.floor(lon/NAK_SIZE));
      const pSign=Math.floor(lon/30);
      const ascSign=Math.floor(asc/30);

      let reason='';
      let weight=99;

      if(diff<=8){
        reason=`near Ascendant · ${diff.toFixed(1)}°`;
        weight=diff;
      }else if(Math.abs(diff-180)<=8){
        reason=`opposite Ascendant · ${Math.abs(diff-180).toFixed(1)}°`;
        weight=10+Math.abs(diff-180);
      }else if(pNak===nakIndex){
        reason='same rising nakshatra';
        weight=20;
      }else if(pSign===ascSign){
        reason='same rising sign';
        weight=30;
      }

      return reason?{...p,reason,weight}:null;
    })
    .filter(Boolean)
    .sort((a,b)=>a.weight-b.weight)
    .slice(0,6);
}

function drawSelectedPoint(w,h,earthShiftDeg){
  if(!state.selectedPoint) return;
  const {lat,lon}=state.selectedPoint;
  const xBase=lonToX(lon+earthShiftDeg,w);
  const y=latToY(lat,h);

  ctx.save();
  for(const x of wrappedXs(xBase,w)){
    ctx.beginPath();
    ctx.arc(x,y,10,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,214,102,.95)';
    ctx.lineWidth=2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x-14,y);ctx.lineTo(x+14,y);
    ctx.moveTo(x,y-14);ctx.lineTo(x,y+14);
    ctx.strokeStyle='rgba(255,214,102,.75)';
    ctx.lineWidth=1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWrappedCanvas(source,w,h,shiftDeg){
  const shiftPx=shiftDeg/360*w;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  for(const copy of [-1,0,1]){
    ctx.drawImage(source,shiftPx+copy*w,0,w,h);
  }
  ctx.restore();
}

function drawEdgeFade(w,h){
  const left=ctx.createLinearGradient(0,0,34,0);
  left.addColorStop(0,'rgba(2,8,18,.9)');
  left.addColorStop(1,'rgba(2,8,18,0)');
  ctx.fillStyle=left;ctx.fillRect(0,0,34,h);

  const right=ctx.createLinearGradient(w-34,0,w,0);
  right.addColorStop(0,'rgba(2,8,18,0)');
  right.addColorStop(1,'rgba(2,8,18,.9)');
  ctx.fillStyle=right;ctx.fillRect(w-34,0,34,h);
}

function updateText(){
  const {date,placements}=state.astro;
  document.getElementById('timeText').textContent=date.toLocaleString();
  updateFocusSummary();
  document.getElementById('planetList').innerHTML=placements.map(p=>{
    const ni=Math.min(26,Math.floor(normalize360(p.lon)/NAK_SIZE));
    return `<div><span style="color:${p.color}">${p.glyph}</span><b>${p.name}</b><span>${fullZodiac(p.lon)} · ${NAKSHATRAS[ni]}</span></div>`;
  }).join('');
}

function buildNakshatraKey(){
  document.getElementById('nakshatraKey').innerHTML=
    NAKSHATRAS.map((name,i)=>`<span><i style="background:${nakColorCss(i)}"></i>${name}</span>`).join('');
}

function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const rect=canvas.getBoundingClientRect();
  canvas.width=Math.max(1,Math.round(rect.width*dpr));
  canvas.height=Math.max(1,Math.round(rect.height*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}

function extractPolygons(geo){
  const out=[];
  for(const f of geo.features||[]){
    const g=f.geometry;
    if(!g) continue;
    if(g.type==='Polygon') out.push(g.coordinates);
    if(g.type==='MultiPolygon') g.coordinates.forEach(p=>out.push(p));
  }
  return out;
}

function solarCoordinates(date){
  const vec=A.GeoVector(A.Body.Sun,date,true);
  const eq=A.EquatorFromVector(vec);
  const raDeg=Number(eq.ra)*15;
  const dec=Number(eq.dec);
  if(!Number.isFinite(raDeg) || !Number.isFinite(dec)){
    throw new Error('Invalid geocentric Sun coordinates');
  }
  const subsolarLon=normalize180(raDeg-greenwichSiderealDegrees(date));
  return {subsolarLat:dec,subsolarLon};
}

function lonToX(lon,w){
  return (normalize180(lon)+180)/360*w;
}
function xToLon(x,w){
  return x/w*360-180;
}
function latToY(lat,h){
  return (90-lat)/180*h;
}
function yToLat(y,h){
  return 90-y/h*180;
}
function wrappedXs(x,w){
  return [x-w,x,x+w].filter(v=>v>-90&&v<w+90);
}

function lahiriAyanamsa(date){
  const jd=julianDate(date);
  const T=(jd-2451545.0)/36525;
  return (85885.53+5028.796195*T+1.1054348*T*T+.00007964*T*T*T)/3600;
}
function julianDate(date){return date.getTime()/86400000+2440587.5;}
function greenwichSiderealDegrees(date){
  const jd=julianDate(date);
  const T=(jd-2451545.0)/36525;
  return normalize360(
    280.46061837+
    360.98564736629*(jd-2451545.0)+
    .000387933*T*T-
    (T*T*T)/38710000
  );
}
function meanObliquityFromDate(date){
  const T=(julianDate(date)-2451545.0)/36525;
  return 23.43929111-(46.8150*T+.00059*T*T-.001813*T*T*T)/3600;
}
function meanNodeTropicalLongitude(date){
  const T=(julianDate(date)-2451545.0)/36525;
  return normalize360(125.04452-1934.136261*T+.0020708*T*T+(T*T*T)/450000);
}
function tropicalAscendant(date,latDeg,lonDeg){
  const theta=rad(normalize360(greenwichSiderealDegrees(date)+lonDeg));
  const phi=rad(latDeg);
  const eps=rad(meanObliquityFromDate(date));

  return normalize360(
    Math.atan2(
      -Math.cos(theta),
      Math.sin(theta)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)
    )*180/Math.PI+180
  );
}

function hexToRgb(hex){
  const h=hex.replace('#','');
  const n=parseInt(h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

function hslToRgb(h,s,l){
  const hue2rgb=(p,q,t)=>{
    if(t<0)t+=1;if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;
    if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;
    return p;
  };
  let r,g,b;
  if(s===0){r=g=b=l;}
  else{
    const q=l<.5?l*(1+s):l+s-l*s;
    const p=2*l-q;
    r=hue2rgb(p,q,h+1/3);
    g=hue2rgb(p,q,h);
    b=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}

function normalize360(x){return ((x%360)+360)%360;}
function normalize180(x){return ((x+180)%360+360)%360-180;}
function rad(x){return x*Math.PI/180;}

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
function nakColorCss(i){
  return `hsl(${Math.round(i/27*360)} 72% 58%)`;
}
function hexToRgba(color,a){
  if(color.startsWith('hsl')) return color.replace('hsl(','hsla(').replace(')',` / ${a})`);
  const h=color.replace('#','');
  const n=parseInt(h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
