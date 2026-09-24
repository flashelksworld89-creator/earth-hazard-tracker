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
  labelsReady: false,
  zoom: 1,
  viewOffsetX: 0,
  viewOffsetY: 0
};

init();

async function init(){
  buildNakshatraKey();
  populateFocusControls();
  bindControls();
  updateZoomText();
  loadPoliticalLabels();
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
  document.querySelectorAll('[data-minutes]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      freezePlayback();
      state.offsetMs += Number(btn.dataset.minutes)*60000;
      refreshAstronomy();
    });
  });

  document.getElementById('resetBtn').addEventListener('click',()=>{
    state.playing=false;
    state.offsetMs=0;
    document.getElementById('playBtn').textContent='▶ Play';
    refreshAstronomy();
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

  ['showDayNight','showZodiac','showNakshatras','showGandanta','showPlanets','showGrid','showPlaceLabels']
    .forEach(id=>document.getElementById(id).addEventListener('change',draw));

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
    state.offsetMs=currentDate().getTime()-Date.now();
  }
  state.playing=false;
  document.getElementById('playBtn').textContent='▶ Play';
}

function currentDate(){
  if(state.playing){
    return new Date(state.epochAstro+(performance.now()-state.epochReal)*state.speed);
  }
  return new Date(Date.now()+state.offsetMs);
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
        placements.push({name,glyph,color,lon:normalize360(lon-aya)});
      }catch(bodyErr){
        console.error('Planet calculation failed:',name,bodyErr);
      }
    }

    const rahu=normalize360(meanNodeTropicalLongitude(date)-aya);
    placements.push(
      {name:'Rahu',glyph:'☊',color:'#06d6a0',lon:rahu},
      {name:'Ketu',glyph:'☋',color:'#ef476f',lon:normalize360(rahu+180)}
    );

    state.astro={date,aya,eps,gmst,sun,placements,realStamp:performance.now()};
    document.getElementById('statusText').textContent=
      `World loaded · Lahiri sidereal · ${placements.length} bodies`;
    updateText();
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

  if(state.astro){
    if(document.getElementById('showDayNight').checked){
      drawDayNight(w,h,earthShiftDeg);
    }

    drawRisingField(w,h,earthShiftDeg,frameDate);

    if(document.getElementById('showPlaceLabels').checked){
      drawPoliticalLabels(w,h,earthShiftDeg);
    }

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
    [0.18,0.52,0.84].forEach(yFrac=>{
      const row=Math.max(0,Math.min(rh-1,Math.floor(yFrac*rh)));
      drawCenteredRuns(
        state.risingSignGrid,row,12,w,h*yFrac,
        index=>`${SIGNS[index][1]} ${SIGNS[index][0]}`,
        index=>SIGNS[index][2],
        13,30
      );
    });
  }

  if(showNak && w>720){
    const yFrac=.69;
    const row=Math.max(0,Math.min(rh-1,Math.floor(yFrac*rh)));
    drawCenteredRuns(
      state.risingNakGrid,row,27,w,h*yFrac,
      index=>NAKSHATRAS[index],
      index=>nakColorCss(index),
      9,18
    );
  }

  function drawCenteredRuns(grid,row,count,screenW,y,labelFor,colorFor,size,minScreenWidth){
    let start=0;
    let current=grid[row*rw];

    for(let x=1;x<=rw;x++){
      const next=x<rw?grid[row*rw+x]:255;
      if(next!==current){
        const runWidth=(x-start)/rw*screenW;
        if(current<count && runWidth>=minScreenWidth){
          const center=(start+x)/2/rw*screenW + earthShiftDeg/360*screenW;
          for(const cx of [center-screenW,center,center+screenW]){
            if(cx>-80 && cx<screenW+80){
              drawFieldLabel(labelFor(current),colorFor(current),cx,y,size);
            }
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

function drawProjectedPlanets(w,h,earthShiftDeg){
  if(!state.risingNakGrid) return;

  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  const row=Math.floor(rh*.5);
  const occupied=new Map();

  state.astro.placements.forEach(p=>{
    const targetNak=Math.min(26,Math.floor(normalize360(p.lon)/NAK_SIZE));
    let start=-1,end=-1;

    for(let x=0;x<rw;x++){
      const ni=state.risingNakGrid[row*rw+x];
      if(ni===targetNak){
        if(start<0) start=x;
        end=x;
      }else if(start>=0){
        break;
      }
    }

    if(start<0) return;
    const xBase=((start+end+1)/2)/rw*w + earthShiftDeg/360*w;
    const visibleXs=[xBase-w,xBase,xBase+w].filter(x=>x>-70&&x<w+70);
    const x=visibleXs.length?visibleXs[0]:xBase;
    const bucket=Math.round(x/58);
    const slot=occupied.get(bucket)||0;
    occupied.set(bucket,slot+1);
    const y=h*.40+slot*19;

    const signIndex=Math.floor(normalize360(p.lon)/30);
    const matchesFocus=
      state.focusSign===null && state.focusNak===null
        ? true
        : state.focusSign!==null
          ? signIndex===state.focusSign
          : targetNak===state.focusNak;

    ctx.save();
    ctx.globalAlpha=matchesFocus?1:.16;
    ctx.font=`${matchesFocus?'900':'700'} ${matchesFocus?17:14}px system-ui,Segoe UI Symbol,sans-serif`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle=p.color;
    ctx.shadowColor='rgba(0,0,0,.98)';
    ctx.shadowBlur=matchesFocus?8:3;
    for(const px of visibleXs){
      ctx.fillText(`${p.glyph} ${degreeInSign(p.lon)}`,px,y);
    }
    ctx.restore();
  });
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

    state.countryLabels=(countries.features||[])
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
  const coreForecast=buildCoreLocationForecast(houses,asc,nakIndex,date);

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

  document.getElementById('inspectCoreForecast').innerHTML=coreForecast.map(item=>`
    <article class="forecast-card">
      <div class="forecast-card-head">
        <span class="forecast-house">H${item.house}</span>
        <div>
          <b>${item.title}</b>
          <small>${item.signText} · lord ${item.lord}</small>
        </div>
        <span class="forecast-balance ${item.tone}">${item.balanceText}</span>
      </div>
      <p>${item.message}</p>
      <div class="forecast-reasons">${item.reasons.map(r=>`<span class="${r.kind}">${r.text}</span>`).join('')}</div>
    </article>`).join('');

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

function buildCoreLocationForecast(houses,asc,nakIndex,date){
  const sectors=[
    {house:1,title:'Self / Immediate Experience'},
    {house:3,title:'Local Travel / Communication'},
    {house:7,title:'Other People / Encounters'},
    {house:9,title:'Long Distance / Guidance'}
  ];
  const ascLord=houses[0].lord;

  return sectors.map(sector=>{
    const house=houses[sector.house-1];
    const evidence=[];
    let score=0;

    const add=(text,value=0,kind='neutral')=>{
      evidence.push({text,value,kind});
      score+=value;
    };

    // 1) Occupants of the target house.
    for(const p of house.planets.filter(p=>CLASSICAL_GRAHAS.has(p.name))){
      const nature=planetNatureScore(p.name);
      add(
        `${p.glyph} ${p.name} occupies H${sector.house}`,
        nature,
        nature>0?'positive':nature<0?'negative':'neutral'
      );
      const dignity=planetDignity(p);
      if(dignity.score){
        add(`${p.name}: ${dignity.label}`,dignity.score,dignity.score>0?'positive':'negative');
      }
      if(isGandanta(p.lon)){
        add(`${p.name} is in the strict gandanta zone`,-0.5,'caution');
      }
    }

    // 2) House lord condition.
    const lordPlanet=findPlacement(house.lord);
    const lordHouse=lordPlanet?planetHouseNumber(lordPlanet.lon,houses):null;
    if(lordPlanet){
      add(`${house.lord}, H${sector.house} lord, is in H${lordHouse}`,housePlacementScore(lordHouse),housePlacementScore(lordHouse)>=0?'positive':'negative');

      const dignity=planetDignity(lordPlanet);
      add(`${house.lord}: ${dignity.label}`,dignity.score,dignity.score>0?'positive':dignity.score<0?'negative':'neutral');

      if(isCombust(lordPlanet)){
        add(`${house.lord} is within its combustion threshold of the Sun`,-1.25,'negative');
      }

      if(isPlanetRetrograde(lordPlanet.name,date)){
        add(`${house.lord} is retrograde: stronger internal/revisional emphasis`,0,'caution');
      }

      if(isGandanta(lordPlanet.lon)){
        add(`${house.lord} is in strict gandanta`,-0.75,'caution');
      }

      for(const c of closeConjunctions(lordPlanet,8)){
        const cScore=planetNatureScore(c.planet.name)*conjunctionStrength(c.diff);
        add(
          `${house.lord} conjunct ${c.planet.name} · ${c.diff.toFixed(1)}°`,
          cScore,
          cScore>0?'positive':cScore<0?'negative':'neutral'
        );
      }
    }

    // 3) Full Jyotish graha aspects to the target house.
    for(const aspect of fullAspectsToHouse(sector.house,houses)){
      const val=planetNatureScore(aspect.planet.name)*0.8;
      add(
        `${aspect.planet.name} casts its ${aspect.aspectName} full aspect to H${sector.house}`,
        val,
        val>0?'positive':val<0?'negative':'neutral'
      );
    }

    // 4) Relationship between target lord and Ascendant lord.
    if(house.lord!==ascLord && lordPlanet){
      const ascLordPlanet=findPlacement(ascLord);
      if(ascLordPlanet){
        const relation=compoundPlanetaryRelationship(house.lord,ascLord,lordPlanet,ascLordPlanet);
        add(
          `H${sector.house} lord ${house.lord} is ${relation.label} with ASC lord ${ascLord}`,
          relation.score*0.55,
          relation.score>0?'positive':relation.score<0?'negative':'neutral'
        );
      }
    }

    // 5) Bhavat-bhavam: same house counted from itself.
    const bb=bhavatBhavamHouse(sector.house);
    if(bb!==sector.house){
      const bbHouse=houses[bb-1];
      const bbLord=findPlacement(bbHouse.lord);
      let bbScore=0;
      if(bbLord) bbScore+=planetDignity(bbLord).score*0.3;
      bbScore+=bbHouse.planets
        .filter(p=>CLASSICAL_GRAHAS.has(p.name))
        .reduce((sum,p)=>sum+planetNatureScore(p.name)*0.25,0);
      add(
        `Bhavat-bhavam reinforcement: H${bb} (${SIGNS[bbHouse.sign][0]})`,
        bbScore,
        bbScore>0?'positive':bbScore<0?'negative':'neutral'
      );
    }

    // 6) Rahu/Ketu axis and dispositors.
    for(const nodeName of ['Rahu','Ketu']){
      const node=findPlacement(nodeName);
      if(!node) continue;
      const nodeHouse=planetHouseNumber(node.lon,houses);
      if(nodeHouse===sector.house){
        add(`${nodeName} occupies H${sector.house}`,-1.4,'negative');
        const disp=dispositorOf(node);
        if(disp){
          const dd=planetDignity(disp);
          add(`${nodeName} dispositor ${disp.name}: ${dd.label}`,dd.score*0.5,dd.score>0?'positive':dd.score<0?'negative':'neutral');
        }
      }else if(fullAspectOffsets(nodeName).includes((sector.house-nodeHouse+12)%12)){
        add(`${nodeName} casts the configured 7th-house aspect to H${sector.house}`,-0.75,'caution');
      }
    }

    // 7) Moon context.
    const moon=findPlacement('Moon');
    if(moon){
      const moonHouse=planetHouseNumber(moon.lon,houses);
      const moonNak=Math.min(26,Math.floor(normalize360(moon.lon)/NAK_SIZE));
      if(moonHouse===sector.house){
        add(`Moon activates H${sector.house} from ${NAKSHATRAS[moonNak]}`,0.6,'positive');
      }else{
        add(`Moon is in H${moonHouse} · ${NAKSHATRAS[moonNak]}`,0,'neutral');
      }
    }

    // 8) Extra Ascendant sensitivity for H1.
    if(sector.house===1){
      if(isGandanta(asc)) add('Local Ascendant is in strict gandanta',-0.75,'caution');
      for(const p of (state.astro?.placements||[])){
        if(!CLASSICAL_GRAHAS.has(p.name)) continue;
        const diff=Math.abs(normalize180(normalize360(p.lon)-asc));
        if(diff<=6){
          const val=planetNatureScore(p.name)*conjunctionStrength(diff);
          add(`${p.name} within ${diff.toFixed(1)}° of the local ASC`,val,val>0?'positive':val<0?'negative':'neutral');
        }
      }
    }

    const tone=forecastTone(score);
    return {
      house:sector.house,
      title:sector.title,
      signText:`${SIGNS[house.sign][1]} ${SIGNS[house.sign][0]}`,
      lord:house.lord,
      score,
      tone:tone.key,
      balanceText:`${tone.label} · ${score>=0?'+':''}${score.toFixed(1)}`,
      message:advancedForecastMessage(sector.house,tone,house,lordHouse,nakIndex,evidence),
      reasons:evidence
        .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))
        .slice(0,9)
    };
  });
}

function advancedForecastMessage(houseNumber,tone,house,lordHouse,nakIndex,evidence){
  const sign=SIGNS[house.sign][0];
  const lordText=lordHouse?`${house.lord} carries this topic into H${lordHouse}`:`${house.lord} rules this topic`;
  const sector={
    1:'immediate experience, initiative and how you meet the environment',
    3:'short travel, messages, neighbors and local movement',
    7:'meetings, agreements and direct encounters with other people',
    9:'long-distance travel, teachers, belief, study and broader direction'
  }[houseNumber];

  const strongest=evidence
    .filter(e=>Math.abs(e.value)>=0.7)
    .slice(0,2)
    .map(e=>e.text);

  const why=strongest.length?` Strongest factors: ${strongest.join('; ')}.`:'';
  return `${sign} governs ${sector}; ${lordText}. The evidence balance is ${tone.description}. `+
    `The local Ascendant remains rooted in ${NAKSHATRAS[nakIndex]}.${why}`;
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
