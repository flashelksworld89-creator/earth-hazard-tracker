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

const state = {
  land: [],
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
  risingNakGrid: null
};

init();

async function init(){
  buildNakshatraKey();
  bindControls();
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

  ['showDayNight','showZodiac','showNakshatras','showPlanets','showGrid']
    .forEach(id=>document.getElementById(id).addEventListener('change',draw));

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
  const panel=document.querySelector('.control-panel');
  const body=document.getElementById('transitPanelBody');

  collapseBtn.addEventListener('click',()=>{
    const collapsed=!body.hidden;
    body.hidden=collapsed;
    panel.classList.toggle('collapsed',collapsed);
    collapseBtn.textContent=collapsed?'⌃':'⌄';
    collapseBtn.setAttribute('aria-expanded',String(!collapsed));
    collapseBtn.setAttribute('aria-label',collapsed?'Expand transit controls':'Collapse transit controls');
    collapseBtn.title=collapsed?'Expand transit controls':'Collapse transit controls';
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
  const earthShiftDeg = phase;

  if(document.getElementById('showGrid').checked) drawGrid(w,h,earthShiftDeg);
  if(state.mapReady) drawLand(w,h,earthShiftDeg);

  if(state.astro){
    if(document.getElementById('showDayNight').checked){
      drawDayNight(w,h,earthShiftDeg);
    }

    drawRisingField(w,h,earthShiftDeg,frameDate);

    if(document.getElementById('showPlanets').checked){
      drawProjectedPlanets(w,h,earthShiftDeg,frameDate);
    }
  }

  drawEdgeFade(w,h);
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
  ctx.save();
  ctx.fillStyle='#183c52';
  ctx.strokeStyle='rgba(135,201,229,.48)';
  ctx.lineWidth=.8;

  for(const poly of state.land){
    drawPolygon(poly,w,h,shiftDeg);
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
  if(!showZodiac && !showNak) return;

  buildRisingCache(frameDate,earthShiftDeg,showZodiac,showNak);

  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(risingCanvas,0,0,w,h);
  ctx.restore();

  drawRisingLabels(w,h,showZodiac,showNak);
}

function buildRisingCache(date,earthShiftDeg,showZodiac,showNak){
  const rw=risingCanvas.width;
  const rh=risingCanvas.height;
  const dayKey=date.toISOString().slice(0,10);
  const cacheKey=`${dayKey}|${showZodiac?1:0}|${showNak?1:0}`;
  if(state.risingCacheKey===cacheKey && state.risingSignGrid && state.risingNakGrid) return;

  const img=risingCtx.createImageData(rw,rh);
  const data=img.data;
  const signGrid=new Uint8Array(rw*rh);
  const nakGrid=new Uint8Array(rw*rh);
  const aya=lahiriAyanamsa(date);

  for(let py=0;py<rh;py++){
    const lat=yToLat(py+.5,rh);

    for(let px=0;px<rw;px++){
      const mapLng=xToLon(px+.5,rw);
      const earthLng=normalize180(mapLng-earthShiftDeg);
      const asc=normalize360(tropicalAscendant(date,lat,earthLng)-aya);
      const signIndex=Math.floor(asc/30);
      const nakIndex=Math.min(26,Math.floor(asc/NAK_SIZE));
      const cell=py*rw+px;

      signGrid[cell]=signIndex;
      nakGrid[cell]=nakIndex;

      const signColor=hexToRgb(SIGNS[signIndex][2]);
      const nakColor=hslToRgb(nakIndex/27,.72,.58);

      let r=signColor[0],g=signColor[1],b=signColor[2],alpha=0;
      if(showZodiac) alpha=.14;

      if(showNak){
        if(showZodiac){
          r=Math.round(r*.72+nakColor[0]*.28);
          g=Math.round(g*.72+nakColor[1]*.28);
          b=Math.round(b*.72+nakColor[2]*.28);
          alpha=.18;
        }else{
          r=nakColor[0];g=nakColor[1];b=nakColor[2];alpha=.13;
        }
      }

      const p=cell*4;
      data[p]=r;data[p+1]=g;data[p+2]=b;data[p+3]=Math.round(alpha*255);
    }
  }

  risingCtx.putImageData(img,0,0);

  // Boundary lines are drawn on the cached layer so they stay crisp but inexpensive.
  risingCtx.save();
  for(let py=1;py<rh-1;py++){
    for(let px=1;px<rw-1;px++){
      const i=py*rw+px;
      const right=i+1;
      const down=i+rw;

      if(showZodiac && (signGrid[i]!==signGrid[right] || signGrid[i]!==signGrid[down])){
        risingCtx.fillStyle='rgba(255,255,255,.42)';
        risingCtx.fillRect(px,py,1,1);
      }else if(showNak && (nakGrid[i]!==nakGrid[right] || nakGrid[i]!==nakGrid[down])){
        risingCtx.fillStyle='rgba(210,235,248,.20)';
        risingCtx.fillRect(px,py,1,1);
      }
    }
  }
  risingCtx.restore();

  state.risingSignGrid=signGrid;
  state.risingNakGrid=nakGrid;
  state.risingCacheKey=cacheKey;
}

function drawRisingLabels(w,h,showZodiac,showNak){
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
          const center=(start+x)/2/rw*screenW;
          drawFieldLabel(labelFor(current),colorFor(current),center,y,size);
        }
        start=x;
        current=next;
      }
    }
  }
}

function drawFieldLabel(text,color,x,y,size){
  ctx.save();
  ctx.font=`700 ${size}px system-ui,Segoe UI Symbol,sans-serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle=color;
  ctx.shadowColor='rgba(0,0,0,.98)';
  ctx.shadowBlur=5;
  ctx.fillText(text,x,y);
  ctx.restore();
}

function drawProjectedPlanets(w,h,earthShiftDeg,frameDate){
  const date=frameDate;
  const aya=lahiriAyanamsa(date);
  const occupied=new Map();

  state.astro.placements.forEach(p=>{
    const targetNak=Math.min(26,Math.floor(normalize360(p.lon)/NAK_SIZE));
    const candidates=[];

    for(let x=0;x<w;x+=4){
      const mapLng=xToLon(x,w);
      const earthLng=normalize180(mapLng-earthShiftDeg);
      const asc=normalize360(tropicalAscendant(date,0,earthLng)-aya);
      const ni=Math.min(26,Math.floor(asc/NAK_SIZE));
      if(ni===targetNak) candidates.push(x);
    }

    if(!candidates.length) return;
    const x=candidates[Math.floor(candidates.length/2)];
    const bucket=Math.round(x/55);
    const slot=occupied.get(bucket)||0;
    occupied.set(bucket,slot+1);
    const y=h*.42+slot*19;

    ctx.save();
    ctx.font='800 15px system-ui,Segoe UI Symbol,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle=p.color;
    ctx.shadowColor='rgba(0,0,0,.98)';
    ctx.shadowBlur=6;
    ctx.fillText(`${p.glyph} ${degreeInSign(p.lon)}`,x,y);
    ctx.restore();
  });
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
