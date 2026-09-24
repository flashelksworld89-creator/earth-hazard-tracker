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

const state = {
  land: [],
  playing: false,
  speed: 1,
  offsetMs: 0,
  epochAstro: Date.now(),
  epochReal: performance.now(),
  lastDraw: 0,
  astro: null,
  mapReady: false
};

init();

async function init(){
  buildNakshatraKey();
  bindControls();
  resize();
  window.addEventListener('resize', resize);

  try{
    const r = await fetch(
      'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@ca96624a/geojson/ne_110m_land.geojson',
      { cache:'force-cache' }
    );
    if(!r.ok) throw new Error('World map HTTP '+r.status);
    const geo = await r.json();
    state.land = extractPolygons(geo);
    state.mapReady = true;
    document.getElementById('statusText').textContent='World geometry loaded · Lahiri sidereal';
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

  const aya=lahiriAyanamsa(date);
  const eps=meanObliquityFromDate(date);
  const gmst=greenwichSiderealDegrees(date);
  const sun=solarCoordinates(date);

  const placements=PLANETS.map(([name,bodyKey,glyph,color])=>{
    const vec=A.GeoVector(A.Body[bodyKey],date,true);
    const ecl=A.Ecliptic(vec);
    return {name,glyph,color,lon:normalize360(Number(ecl.elon)-aya)};
  });

  const rahu=normalize360(meanNodeTropicalLongitude(date)-aya);
  placements.push(
    {name:'Rahu',glyph:'☊',color:'#06d6a0',lon:rahu},
    {name:'Ketu',glyph:'☋',color:'#ef476f',lon:normalize360(rahu+180)}
  );

  state.astro={date,aya,eps,gmst,sun,placements,realStamp:performance.now()};
  updateText();
  draw();
}

function draw(){
  const w=canvas.clientWidth;
  const h=canvas.clientHeight;
  if(!w||!h||!state.astro) return;

  ctx.clearRect(0,0,w,h);
  drawBackground(w,h);

  const phase = normalize360(state.astro.gmst);
  // Split the daily apparent motion between the two frames so the combined
  // Earth-vs-sky relative motion remains one real sidereal rotation.
  const earthShiftDeg = phase * 0.5;
  const skyShiftDeg = -phase * 0.5;

  if(document.getElementById('showGrid').checked) drawGrid(w,h,earthShiftDeg);

  if(state.mapReady) drawLand(w,h,earthShiftDeg);

  if(document.getElementById('showDayNight').checked){
    drawDayNight(w,h,earthShiftDeg);
  }

  drawEclipticBand(w,h,skyShiftDeg);

  if(document.getElementById('showPlanets').checked){
    drawPlanets(w,h,skyShiftDeg);
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

function drawEclipticBand(w,h,skyShiftDeg){
  const bandHalf=Math.max(18,h*.052);

  if(document.getElementById('showZodiac').checked){
    for(let i=0;i<12;i++){
      drawCelestialSegment(i*30,(i+1)*30,SIGNS[i][2],bandHalf,w,h,skyShiftDeg,.54);
      drawCelestialLabel(i*30+15,`${SIGNS[i][1]} ${SIGNS[i][0]}`,SIGNS[i][2],w,h,skyShiftDeg,-bandHalf*.55);
    }
  }

  if(document.getElementById('showNakshatras').checked){
    for(let i=0;i<27;i++){
      const a=i*NAK_SIZE,b=(i+1)*NAK_SIZE;
      const color=nakColorCss(i);
      drawCelestialSegment(a,b,color,bandHalf*.58,w,h,skyShiftDeg,.44);

      if(w>760 || i%2===0){
        drawCelestialLabel(
          a+NAK_SIZE/2,
          NAKSHATRAS[i],
          color,w,h,skyShiftDeg,bandHalf*.58
        );
      }
    }
  }
}

function drawCelestialSegment(lonA,lonB,color,halfWidth,w,h,skyShiftDeg,alpha){
  const top=[],bottom=[];
  const steps=18;

  for(let j=0;j<=steps;j++){
    const lon=lonA+(lonB-lonA)*(j/steps);
    const pt=bandPoint(lon,w,h,skyShiftDeg);
    top.push([pt.x,pt.y-halfWidth]);
    bottom.push([pt.x,pt.y+halfWidth]);
  }

  for(const copy of [-1,0,1]){
    const dx=copy*w;
    ctx.beginPath();
    top.forEach((p,k)=>k?ctx.lineTo(p[0]+dx,p[1]):ctx.moveTo(p[0]+dx,p[1]));
    bottom.slice().reverse().forEach(p=>ctx.lineTo(p[0]+dx,p[1]));
    ctx.closePath();
    ctx.fillStyle=hexToRgba(color,alpha);
    ctx.fill();

    ctx.strokeStyle=hexToRgba(color,.78);
    ctx.lineWidth=1.1;
    ctx.stroke();
  }
}

function drawCelestialLabel(lon,text,color,w,h,skyShiftDeg,yOffset){
  const p=bandPoint(lon,w,h,skyShiftDeg);
  ctx.save();
  ctx.font=`600 ${Math.max(9,Math.min(13,w/95))}px system-ui,Segoe UI Symbol,sans-serif`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle=color;
  ctx.shadowColor='rgba(0,0,0,.95)';
  ctx.shadowBlur=5;
  for(const x of wrappedXs(p.x,w)){
    ctx.fillText(text,x,p.y+yOffset);
  }
  ctx.restore();
}

function drawPlanets(w,h,skyShiftDeg){
  const occupied=new Map();

  state.astro.placements.forEach((p,index)=>{
    const pt=bandPoint(p.lon,w,h,skyShiftDeg);
    const bucket=Math.round(pt.x/55);
    const slot=occupied.get(bucket)||0;
    occupied.set(bucket,slot+1);
    const y=pt.y-(36+slot*20);

    ctx.save();
    ctx.font='700 15px system-ui,Segoe UI Symbol,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillStyle=p.color;
    ctx.shadowColor='rgba(0,0,0,.95)';
    ctx.shadowBlur=6;

    const label=`${p.glyph} ${degreeInSign(p.lon)}`;
    for(const x of wrappedXs(pt.x,w)){
      ctx.fillText(label,x,y);
    }
    ctx.restore();
  });
}

function bandPoint(siderealLon,w,h,skyShiftDeg){
  const tropicalLon=normalize360(siderealLon+state.astro.aya);
  const lambda=rad(tropicalLon);
  const eps=rad(state.astro.eps);

  const ra=Math.atan2(
    Math.sin(lambda)*Math.cos(eps),
    Math.cos(lambda)
  )*180/Math.PI;

  const dec=Math.asin(
    Math.sin(eps)*Math.sin(lambda)
  )*180/Math.PI;

  const displayLon=normalize180(ra+skyShiftDeg);
  return {
    x:lonToX(displayLon,w),
    y:latToY(dec,h)
  };
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
  const sun=A.Equator(A.Body.Sun,date,null,true,true);
  const raDeg=Number(sun.ra)*15;
  const dec=Number(sun.dec);
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
