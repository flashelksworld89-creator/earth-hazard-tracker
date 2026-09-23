const EARTH_RADIUS_KM = 6371.0088;
const RAY_MAX_KM = 19800;
const RAY_STEP_KM = 180;

const SIGNS = [
  ['Aries','♈','#ff5a5f'],
  ['Taurus','♉','#59c36a'],
  ['Gemini','♊','#ffd166'],
  ['Cancer','♋','#8ecae6'],
  ['Leo','♌','#ff9f1c'],
  ['Virgo','♍','#95d5b2'],
  ['Libra','♎','#e0aaff'],
  ['Scorpio','♏','#c9184a'],
  ['Sagittarius','♐','#9b5de5'],
  ['Capricorn','♑','#8d99ae'],
  ['Aquarius','♒','#00b4d8'],
  ['Pisces','♓','#577590']
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
  'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
  'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha',
  'Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada',
  'Uttara Bhadrapada','Revati'
];

const PLANET_META = [
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

const PLANET_COLORS = {
  Sun:'#ffd166',
  Moon:'#f8f9fa',
  Mercury:'#2ec4b6',
  Venus:'#ff70a6',
  Mars:'#ff3b30',
  Jupiter:'#f4a261',
  Saturn:'#adb5bd',
  Uranus:'#48cae4',
  Neptune:'#4361ee',
  Pluto:'#9d4edd',
  Rahu:'#06d6a0',
  Ketu:'#ef476f'
};

const DIRS = [
  [0,'N'], [45,'NE'], [90,'E'], [135,'SE'],
  [180,'S'], [225,'SW'], [270,'W'], [315,'NW']
];

export function initZodiacCompass(map, maplibregl) {
  const state = {
    enabled:true,
    origin:{lng:map.getCenter().lng, lat:map.getCenter().lat},
    timeOffsetMs:0,
    opacity:.72,
    highlightedPlanet:'',
    shiftHint:false,
    globalZones:true,
    globalNak:true,
    globalSign:'',
    dayNight:true,
    simRunning:false,
    simSpeed:1,
    simEpochReal:Date.now(),
    simEpochAstro:Date.now(),
    simTimer:null,
    lastGlobalFieldMs:0,
    lastData:null
  };

  const ids = {
    signs:'zodiac-sign-lines',
    nak:'zodiac-nak-lines',
    houses:'zodiac-house-lines',
    dirs:'zodiac-direction-lines',
    planetLines:'zodiac-planet-lines',
    labels:'zodiac-labels',
    planets:'zodiac-planets',
    origin:'zodiac-origin',
    globalZones:'zodiac-global-zones',
    globalBounds:'zodiac-global-bounds',
    globalNak:'zodiac-global-nak',
    globalLabels:'zodiac-global-labels',
    dayNight:'zodiac-day-night'
  };

  try {
    if (!window.Astronomy) {
      throw new Error('Astronomy Engine browser library did not load.');
    }
    addSourcesAndLayers();
    bindControls();
    const toggle = document.getElementById('zodiacLayerToggle');
    if (toggle) toggle.checked = true;
    const panel = document.getElementById('zodiacPanel');
    if (panel) panel.classList.remove('hidden');
    state.enabled = true;
    refresh();
    setVisibility();
    document.getElementById('zodiacStatus').textContent = 'VISIBLE · Sidereal · Lahiri';
  } catch (err) {
    console.error('Zodiacal Compass init error:', err);
    showVisibleError(err);

    // Fallback: ensure controls remain bound and attempt geometry-only rendering.
    try {
      bindControlsSafe();
      state.enabled = true;
      refresh();
      setVisibility();
    } catch (fallbackErr) {
      console.error('Zodiacal Compass fallback error:', fallbackErr);
    }
  }

  setInterval(() => {
    if (state.enabled && !state.simRunning && state.timeOffsetMs === 0) refresh();
  }, 60_000);

  function bindControls() {
    const toggle = document.getElementById('zodiacLayerToggle');
    toggle.dataset.zBound = '1';
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
      state.origin = {lng:c.lng, lat:c.lat};
      refresh();
    });

    document.getElementById('zUseHereBtn').addEventListener('click', () => {
      state.shiftHint = !state.shiftHint;
      showToast(state.shiftHint
        ? 'Click anywhere on the globe to set the Zodiacal Compass origin.'
        : 'Compass origin selection cancelled.');
    });

    map.on('click', (e) => {
      if (!state.enabled) return;
      if (state.shiftHint || e.originalEvent?.shiftKey) {
        state.origin = {lng:e.lngLat.lng, lat:e.lngLat.lat};
        state.shiftHint = false;
        refresh();
        showToast('Zodiacal Compass origin updated.');
      }
    });

    document.querySelectorAll('[data-ztime]').forEach(btn => {
      btn.addEventListener('click', () => {
        stopSimulation();
        state.timeOffsetMs += Number(btn.dataset.ztime) * 60000;
        refresh();
      });
    });

    document.getElementById('zNowBtn').addEventListener('click', () => {
      stopSimulation();
      state.timeOffsetMs = 0;
      state.simEpochAstro = Date.now();
      state.simEpochReal = Date.now();
      refresh();
    });

    document.getElementById('zSimPlayBtn')?.addEventListener('click',()=>{
      if(state.simRunning) stopSimulation();
      else startSimulation();
    });

    document.getElementById('zSimSpeed')?.addEventListener('change',(e)=>{
      const next=Math.max(1,Number(e.target.value)||1);
      const current=getSimulationDate().getTime();
      state.simSpeed=next;
      state.simEpochAstro=current;
      state.simEpochReal=Date.now();
    });

    document.getElementById('zDayNight')?.addEventListener('change',(e)=>{
      state.dayNight=e.target.checked;
      drawDayNight();
      setVisibility();
    });

    document.getElementById('zOpacity').addEventListener('input', (e) => {
      state.opacity = Number(e.target.value)/100;
      updateOpacity();
    });

    document.getElementById('zPlanetSelect').addEventListener('change', (e) => {
      state.highlightedPlanet = e.target.value;
      redrawPlanets();
    });

    document.getElementById('zGlobalZones')?.addEventListener('change',(e)=>{
      state.globalZones=e.target.checked;
      drawGlobalRisingField();
    });

    document.getElementById('zGlobalNak')?.addEventListener('change',(e)=>{
      state.globalNak=e.target.checked;
      drawGlobalRisingField();
    });

    document.getElementById('zGlobalSignSelect')?.addEventListener('change',(e)=>{
      state.globalSign=e.target.value;
      drawGlobalRisingField();
    });
  }


  function bindControlsSafe() {
    const toggle = document.getElementById('zodiacLayerToggle');
    if (!toggle || toggle.dataset.zBound === '1') return;
    toggle.dataset.zBound = '1';
    toggle.addEventListener('change', () => {
      state.enabled = toggle.checked;
      document.getElementById('zodiacPanel')?.classList.toggle('hidden', !state.enabled);
      setVisibility();
      if (state.enabled) refresh();
    });
  }

  function signColorExpression() {
    const expr=['match',['get','signIndex']];
    SIGNS.forEach((s,i)=>expr.push(i,s[2]));
    expr.push('#f0abfc');
    return expr;
  }

  function planetColorExpression() {
    const expr=['match',['get','name']];
    Object.entries(PLANET_COLORS).forEach(([name,color])=>expr.push(name,color));
    expr.push('#e9d5ff');
    return expr;
  }

  function addSourcesAndLayers() {
    const empty = {type:'FeatureCollection',features:[]};
    Object.values(ids).forEach(id => {
      if (!map.getSource(id)) map.addSource(id,{type:'geojson',data:empty});
    });

    if (!map.getLayer(ids.nak)) map.addLayer({
      id:ids.nak,type:'line',source:ids.nak,
      paint:{
        'line-color':'#67e8f9',
        'line-width':1.25,
        'line-opacity':['case',['==',['get','above'],true],.52,.16],
        'line-dasharray':[2,3]
      }
    });
    if (!map.getLayer(ids.signs)) map.addLayer({
      id:ids.signs,type:'line',source:ids.signs,
      paint:{
        'line-color':signColorExpression(),
        'line-width':3.2,
        'line-opacity':['case',['==',['get','above'],true],.94,.22]
      }
    });
    addLine(ids.houses,'#fde68a',1.8,.76,[5,3]);
    addLine(ids.dirs,'#cbd5e1',1.3,.56,[1,4]);

    if (!map.getLayer(ids.planetLines)) map.addLayer({
      id:ids.planetLines,type:'line',source:ids.planetLines,
      paint:{
        'line-color':planetColorExpression(),
        'line-width':['case',['==',['get','highlighted'],true],4,1.8],
        'line-opacity':['case',
          ['==',['get','highlighted'],true],.98,
          ['==',['get','above'],true],.88,.24]
      }
    });

    if (!map.getLayer(ids.labels)) map.addLayer({
      id:ids.labels,type:'symbol',source:ids.labels,
      layout:{
        'text-field':['get','label'],
        'text-size':['case',
          ['==',['get','kind'],'sign'],12,
          ['==',['get','kind'],'direction'],11,
          ['==',['get','kind'],'house'],10,8],
        'text-allow-overlap':false
      },
      paint:{
        'text-color':['case',
          ['==',['get','kind'],'sign'],signColorExpression(),
          ['==',['get','kind'],'direction'],'#e2e8f0',
          ['==',['get','kind'],'house'],'#fde68a','#a5f3fc'],
        'text-halo-color':'#06111f',
        'text-halo-width':1.4
      }
    });

    if (!map.getLayer(ids.planets)) map.addLayer({
      id:ids.planets,type:'symbol',source:ids.planets,
      layout:{
        'text-field':['get','label'],
        'text-size':15,
        'text-allow-overlap':true
      },
      paint:{
        'text-color':planetColorExpression(),
        'text-halo-color':'#190c26',
        'text-halo-width':1.8
      }
    });

    if (!map.getLayer(ids.origin)) map.addLayer({
      id:ids.origin,type:'circle',source:ids.origin,
      paint:{
        'circle-radius':7,
        'circle-color':'#fff',
        'circle-stroke-width':3,
        'circle-stroke-color':'#c084fc'
      }
    });

    if (!map.getLayer(ids.globalZones)) map.addLayer({
      id:ids.globalZones,type:'fill',source:ids.globalZones,
      paint:{
        'fill-color':signColorExpression(),
        'fill-opacity':['case',['==',['get','active'],true],.16,.035]
      }
    });

    if (!map.getLayer(ids.globalBounds)) map.addLayer({
      id:ids.globalBounds,type:'line',source:ids.globalBounds,
      paint:{
        'line-color':signColorExpression(),
        'line-width':2.4,
        'line-opacity':.82
      }
    });

    if (!map.getLayer(ids.globalNak)) map.addLayer({
      id:ids.globalNak,type:'line',source:ids.globalNak,
      paint:{
        'line-color':'#67e8f9',
        'line-width':.8,
        'line-opacity':.42,
        'line-dasharray':[2,3]
      }
    });

    if (!map.getLayer(ids.globalLabels)) map.addLayer({
      id:ids.globalLabels,type:'symbol',source:ids.globalLabels,
      layout:{
        'text-field':['get','label'],
        'text-size':13,
        'text-allow-overlap':true
      },
      paint:{
        'text-color':signColorExpression(),
        'text-halo-color':'#02070d',
        'text-halo-width':2
      }
    });

    if (!map.getLayer(ids.dayNight)) map.addLayer({
      id:ids.dayNight,type:'fill',source:ids.dayNight,
      paint:{
        'fill-color':'#000000',
        'fill-opacity':['case',['==',['get','night'],true],.28,0]
      }
    });
  }

  function addLine(id,color,width,opacity,dash=null) {
    if (map.getLayer(id)) return;
    const paint = {
      'line-color':color,
      'line-width':width,
      'line-opacity':opacity
    };
    if (dash) paint['line-dasharray']=dash;
    map.addLayer({id,type:'line',source:id,paint});
  }

  function refresh() {
    try {
      const date = getSimulationDate();
      state.origin.lat = clamp(state.origin.lat,-89,89);
      state.origin.lng = normalizeLng(state.origin.lng);

      const aya = lahiriAyanamsa(date);
      const asc = normalize360(tropicalAscendant(date,state.origin.lat,state.origin.lng)-aya);
      const dsc = normalize360(asc+180);
      const placements = computePlanetLongitudes(date,aya);
      const localPlanets = computeLocalPlanetSky(date,placements);
      const risingNak = nakshatraInfo(asc);

      state.lastData={date,aya,asc,dsc,placements:localPlanets};

      document.getElementById('zAsc').textContent=zodiacDegree(asc);
      document.getElementById('zDsc').textContent=zodiacDegree(dsc);
      document.getElementById('zAya').textContent=degreeMinute(aya);
      document.getElementById('zTimeLabel').textContent=date.toLocaleString();
      document.getElementById('zOriginLabel').textContent=
        `Observer: ${state.origin.lat.toFixed(4)}°, ${state.origin.lng.toFixed(4)}° · Rising ${SIGNS[Math.floor(asc/30)][1]} ${SIGNS[Math.floor(asc/30)][0]} · ${risingNak.name} P${risingNak.pada}`;
      document.getElementById('zodiacStatus').textContent='LOCAL SKY · Sidereal · Lahiri';
      const ephemerisStatus=document.getElementById('zEphemerisStatus');
      if(ephemerisStatus) ephemerisStatus.textContent=
        'Planet rays = true observer azimuth · altitude shown in list · dim rays are below horizon';

      drawGeometry(asc,date,aya);
      if(!state.simRunning || Math.abs(date.getTime()-state.lastGlobalFieldMs) >= 300000){
        drawGlobalRisingField();
        state.lastGlobalFieldMs=date.getTime();
      }
      drawDayNight();
      redrawPlanets();
      updatePlanetList(localPlanets);

      window.dispatchEvent(new CustomEvent('zodiac-sim-time',{
        detail:{
          timestamp:date.getTime(),
          running:state.simRunning,
          speed:state.simSpeed
        }
      }));
      updateOpacity();
      setVisibility();
    } catch (err) {
      console.error(err);
      showVisibleError(err);
    }
  }

  function showVisibleError(err) {
    const panel=document.getElementById('zodiacPanel');
    panel?.classList.remove('hidden');
    const status=document.getElementById('zodiacStatus');
    if (status) status.textContent='Compass error';
    let box=document.getElementById('zodiacError');
    if (!box && panel) {
      box=document.createElement('div');
      box.id='zodiacError';
      box.className='zodiac-error';
      panel.appendChild(box);
    }
    if (box) box.textContent=`Compass error: ${err?.message || String(err)}`;
  }

  function setVisibility() {
    const v=state.enabled?'visible':'none';
    Object.values(ids).forEach(id=>{
      if (map.getLayer(id)) map.setLayoutProperty(id,'visibility',v);
    });

    if(map.getLayer(ids.globalZones)){
      map.setLayoutProperty(ids.globalZones,'visibility',
        state.enabled && state.globalZones ? 'visible':'none');
    }
    if(map.getLayer(ids.globalNak)){
      map.setLayoutProperty(ids.globalNak,'visibility',
        state.enabled && state.globalNak ? 'visible':'none');
    }
    if(map.getLayer(ids.dayNight)){
      map.setLayoutProperty(ids.dayNight,'visibility',
        state.enabled && state.dayNight ? 'visible':'none');
    }
  }

  function updateOpacity() {
    const pairs=[
      [ids.signs,'line-opacity',.78],
      [ids.nak,'line-opacity',.42],
      [ids.houses,'line-opacity',.65],
      [ids.dirs,'line-opacity',.48],
      [ids.planetLines,'line-opacity',.88],
      [ids.globalBounds,'line-opacity',.82],
      [ids.globalNak,'line-opacity',.42]
    ];
    pairs.forEach(([id,prop,base])=>{
      if(map.getLayer(id)) map.setPaintProperty(id,prop,base*state.opacity);
    });
    if(map.getLayer(ids.labels)) map.setPaintProperty(ids.labels,'text-opacity',state.opacity);
    if(map.getLayer(ids.planets)) map.setPaintProperty(ids.planets,'text-opacity',state.opacity);
    if(map.getLayer(ids.globalLabels)) map.setPaintProperty(ids.globalLabels,'text-opacity',state.opacity);
    if(map.getLayer(ids.globalZones)){
      map.setPaintProperty(ids.globalZones,'fill-opacity',
        ['case',['==',['get','active'],true],.16*state.opacity,.035*state.opacity]);
    }
  }

  function drawGeometry(asc,date,aya) {
    const signs=[],nak=[],houses=[],dirs=[],labels=[];

    for(let i=0;i<12;i++){
      const lon=i*30;
      const edge=localEclipticDirection(date,lon,aya);
      const mid=localEclipticDirection(date,lon+15,aya);
      signs.push(lineFeature(rayCoordinates(edge.az,15000),{
        kind:'sign',signIndex:i,above:edge.alt>=0,alt:edge.alt
      }));
      const pos=destination(state.origin,mid.az,10400);
      labels.push(pointFeature(pos,{
        kind:'sign',signIndex:i,
        label:`${SIGNS[i][1]} ${SIGNS[i][0]} ${mid.alt>=0?'↑':'↓'}${Math.abs(mid.alt).toFixed(0)}°`
      }));
    }

    const nsize=360/27;
    for(let i=0;i<27;i++){
      const lon=i*nsize;
      const edge=localEclipticDirection(date,lon,aya);
      const mid=localEclipticDirection(date,lon+nsize/2,aya);
      nak.push(lineFeature(rayCoordinates(edge.az,11800),{
        kind:'nak',nakIndex:i,above:edge.alt>=0,alt:edge.alt
      }));
      const pos=destination(state.origin,mid.az,i%2?7200:6500);
      labels.push(pointFeature(pos,{
        kind:'nak',
        label:`${NAKSHATRAS[i]} ${mid.alt>=0?'↑':'↓'}`
      }));
    }

    for(let i=0;i<12;i++){
      const b=normalize360(90-i*30);
      houses.push(lineFeature(fullGreatCircle(b),{kind:'house'}));
      labels.push(pointFeature(destination(state.origin,normalize360(75-i*30),4300),
        {kind:'house',label:`H${i+1}`}));
    }

    DIRS.forEach(([b,label])=>{
      dirs.push(lineFeature(fullGreatCircle(b),{kind:'direction'}));
      labels.push(pointFeature(destination(state.origin,b,12800),{kind:'direction',label}));
    });

    labels.push(pointFeature(destination(state.origin,90,2500),
      {kind:'house',label:`ASC ${zodiacDegree(asc)}`}));
    labels.push(pointFeature(destination(state.origin,270,2500),
      {kind:'house',label:`DSC ${zodiacDegree(normalize360(asc+180))}`}));

    setData(ids.signs,signs);
    setData(ids.nak,nak);
    setData(ids.houses,houses);
    setData(ids.dirs,dirs);
    setData(ids.labels,labels);
    setData(ids.origin,[pointFeature(state.origin,{kind:'origin'})]);
  }

  function getSimulationDate(){
    if(state.simRunning){
      const elapsed=Date.now()-state.simEpochReal;
      return new Date(state.simEpochAstro + elapsed*state.simSpeed);
    }
    return new Date(Date.now()+state.timeOffsetMs);
  }

  function startSimulation(){
    const start=getSimulationDate().getTime();
    state.simEpochAstro=start;
    state.simEpochReal=Date.now();
    state.timeOffsetMs=start-Date.now();
    state.simRunning=true;
    const btn=document.getElementById('zSimPlayBtn');
    if(btn) btn.textContent='⏸ Pause';
    clearInterval(state.simTimer);
    state.simTimer=setInterval(()=>refresh(),1000);
    refresh();
  }

  function stopSimulation(){
    if(!state.simRunning){
      const btn=document.getElementById('zSimPlayBtn');
      if(btn) btn.textContent='▶ Play';
      return;
    }
    const now=getSimulationDate().getTime();
    state.simRunning=false;
    state.timeOffsetMs=now-Date.now();
    clearInterval(state.simTimer);
    state.simTimer=null;
    const btn=document.getElementById('zSimPlayBtn');
    if(btn) btn.textContent='▶ Play';
    refresh();
  }

  function drawDayNight(){
    if(!state.lastData) return;
    if(!state.dayNight){
      setData(ids.dayNight,[]);
      return;
    }

    const {date}=state.lastData;
    const A=window.Astronomy;
    const vec=A.GeoVector(A.Body.Sun,date,true);
    const eq=A.EquatorFromVector(vec);
    const sunRaDeg=Number(eq.ra)*15;
    const sunDec=Number(eq.dec);
    const subsolarLon=normalizeLng(sunRaDeg-localSiderealDegrees(date,0));

    const features=[];
    const step=10;
    for(let lat=-80;lat<80;lat+=step){
      for(let lon=-180;lon<180;lon+=step){
        const cLat=lat+step/2;
        const cLon=lon+step/2;
        const H=rad(normalize180(cLon-subsolarLon));
        const phi=rad(cLat);
        const dec=rad(sunDec);
        const sinAlt=
          Math.sin(phi)*Math.sin(dec)+
          Math.cos(phi)*Math.cos(dec)*Math.cos(H);
        const night=sinAlt<0;
        if(!night) continue;
        features.push({
          type:'Feature',
          properties:{night:true},
          geometry:{
            type:'Polygon',
            coordinates:[[
              [lon,lat],[lon+step,lat],[lon+step,lat+step],
              [lon,lat+step],[lon,lat]
            ]]
          }
        });
      }
    }
    setData(ids.dayNight,features);
  }

  function drawGlobalRisingField() {
    if(!state.lastData) return;
    const {date,aya}=state.lastData;

    const zoneFeatures=[];
    const step=6;
    const selected=state.globalSign==='' ? null : Number(state.globalSign);

    if(state.globalZones){
      for(let lat=-84; lat<84; lat+=step){
        for(let lon=-180; lon<180; lon+=step){
          const centerLat=lat+step/2;
          const centerLon=lon+step/2;
          const asc=fastSiderealAscendant(date,centerLat,centerLon,aya);
          const signIndex=Math.floor(asc/30);
          const nak=nakshatraInfo(asc);
          const active=selected===null || selected===signIndex;

          zoneFeatures.push({
            type:'Feature',
            properties:{
              signIndex,
              nakIndex:nak.index,
              pada:nak.pada,
              active
            },
            geometry:{
              type:'Polygon',
              coordinates:[[
                [lon,lat],
                [lon+step,lat],
                [lon+step,lat+step],
                [lon,lat+step],
                [lon,lat]
              ]]
            }
          });
        }
      }
    }

    const signBounds=[];
    const nakBounds=[];
    const labels=[];

    for(let i=0;i<12;i++){
      const segments=globalRisingBoundary(date,i*30,aya,2);
      segments.forEach(seg=>{
        signBounds.push({
          type:'Feature',
          properties:{signIndex:i},
          geometry:{type:'LineString',coordinates:seg}
        });
      });

      const midLon=longitudeWhereSiderealPointRises(date,i*30+15,0,aya);
      if(Number.isFinite(midLon)){
        labels.push(pointFeature([midLon,0],{
          kind:'globalSign',
          signIndex:i,
          label:`${SIGNS[i][1]} ${SIGNS[i][0]} rising`
        }));
      }
    }

    if(state.globalNak){
      const nsize=360/27;
      for(let i=0;i<27;i++){
        const segments=globalRisingBoundary(date,i*nsize,aya,3);
        segments.forEach(seg=>{
          nakBounds.push({
            type:'Feature',
            properties:{nakIndex:i},
            geometry:{type:'LineString',coordinates:seg}
          });
        });
      }
    }

    setData(ids.globalZones,zoneFeatures);
    setData(ids.globalBounds,signBounds);
    setData(ids.globalNak,nakBounds);
    setData(ids.globalLabels,labels);

    const zoneVis=state.enabled && state.globalZones ? 'visible':'none';
    const nakVis=state.enabled && state.globalNak ? 'visible':'none';
    if(map.getLayer(ids.globalZones)) map.setLayoutProperty(ids.globalZones,'visibility',zoneVis);
    if(map.getLayer(ids.globalBounds)) map.setLayoutProperty(ids.globalBounds,'visibility',state.enabled?'visible':'none');
    if(map.getLayer(ids.globalLabels)) map.setLayoutProperty(ids.globalLabels,'visibility',state.enabled?'visible':'none');
    if(map.getLayer(ids.globalNak)) map.setLayoutProperty(ids.globalNak,'visibility',nakVis);
  }

  function fastSiderealAscendant(date,latDeg,lonDeg,aya){
    const jd=julianDate(date);
    const T=(jd-2451545.0)/36525;
    const theta=rad(localSiderealDegrees(date,lonDeg));
    const phi=rad(clamp(latDeg,-89.5,89.5));
    const eps=rad(meanObliquity(T));

    const tropical=normalize360(
      deg(Math.atan2(
        -Math.cos(theta),
        Math.sin(theta)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)
      ))+180
    );

    return normalize360(tropical-aya);
  }

  function longitudeWhereSiderealPointRises(date,siderealLon,latDeg,aya){
    const jd=julianDate(date);
    const T=(jd-2451545.0)/36525;
    const eps=rad(meanObliquity(T));
    const lam=rad(normalize360(siderealLon+aya));
    const phi=rad(clamp(latDeg,-89.5,89.5));

    const ra=normalize360(deg(Math.atan2(
      Math.sin(lam)*Math.cos(eps),
      Math.cos(lam)
    )));
    const dec=Math.asin(Math.sin(eps)*Math.sin(lam));

    const cosH=-Math.tan(phi)*Math.tan(dec);
    if(cosH < -1 || cosH > 1) return NaN;

    const H=-deg(Math.acos(clamp(cosH,-1,1)));
    const lst=normalize360(ra+H);
    const gmst=localSiderealDegrees(date,0);
    return normalizeLng(lst-gmst);
  }

  function globalRisingBoundary(date,siderealLon,aya,latStep=2){
    const segments=[];
    let current=[];
    let previous=null;

    for(let lat=-88; lat<=88; lat+=latStep){
      const lon=longitudeWhereSiderealPointRises(date,siderealLon,lat,aya);

      if(!Number.isFinite(lon)){
        if(current.length>1) segments.push(current);
        current=[];
        previous=null;
        continue;
      }

      const point=[lon,lat];
      if(previous && Math.abs(point[0]-previous[0])>180){
        if(current.length>1) segments.push(current);
        current=[point];
      } else {
        current.push(point);
      }
      previous=point;
    }

    if(current.length>1) segments.push(current);
    return segments;
  }

  function redrawPlanets() {
    if(!state.lastData) return;
    const {placements}=state.lastData;
    const lines=[],points=[];
    placements.forEach(p=>{
      const b=p.az;
      const highlighted=state.highlightedPlanet===p.name;
      lines.push(lineFeature(rayCoordinates(b,highlighted?15000:11800),
        {name:p.name,highlighted,above:p.alt>=0,alt:p.alt}));
      points.push(pointFeature(destination(state.origin,b,highlighted?9200:8500),
        {
          name:p.name,
          highlighted,
          above:p.alt>=0,
          label:`${p.glyph} ${p.name} ${azToCompass(p.az)} ${p.alt>=0?'↑':'↓'}${Math.abs(p.alt).toFixed(0)}°`
        }));
    });
    setData(ids.planetLines,lines);
    setData(ids.planets,points);
  }

  function updatePlanetList(placements) {
    document.getElementById('zPlanetList').innerHTML=placements.map(p=>{
      const color=PLANET_COLORS[p.name]||'#e9d5ff';
      const horizon=p.alt>=0
        ? `${azToCompass(p.az)} · ${p.alt.toFixed(1)}° above`
        : `${azToCompass(p.az)} · ${Math.abs(p.alt).toFixed(1)}° below`;
      return `<div class="z-planet-item" style="--planet-color:${color}">
        <b>${p.glyph} ${p.name}</b>
        <span>${zodiacDegree(p.lon)} · ${horizon}</span>
      </div>`;
    }).join('');
  }

  function computePlanetLongitudes(date,aya) {
    const A=window.Astronomy;
    if(!A) throw new Error('Astronomy Engine is unavailable.');

    const vals=[];
    PLANET_META.forEach(([name,bodyKey,glyph])=>{
      const body=A.Body[bodyKey];
      const vec=A.GeoVector(body,date,true);
      const ecl=A.Ecliptic(vec);
      vals.push({
        name,
        bodyKey,
        glyph,
        lon:normalize360(Number(ecl.elon)-aya),
        tropical:Number(ecl.elon),
        lat:Number(ecl.elat||0)
      });
    });

    const rahuTropical=meanAscendingNode(date);
    const rahu=normalize360(rahuTropical-aya);
    vals.push({name:'Rahu',glyph:'☊',lon:rahu,tropical:rahuTropical,lat:0});
    vals.push({name:'Ketu',glyph:'☋',lon:normalize360(rahu+180),tropical:normalize360(rahuTropical+180),lat:0});
    return vals;
  }

  function computeLocalPlanetSky(date,placements) {
    const A=window.Astronomy;
    const observer=new A.Observer(state.origin.lat,state.origin.lng,0);

    return placements.map(p=>{
      if(p.bodyKey){
        const equ=A.Equator(A.Body[p.bodyKey],date,observer,true,true);
        const hor=A.Horizon(date,observer,equ.ra,equ.dec,'normal');
        return {...p,az:normalize360(hor.azimuth),alt:hor.altitude};
      }

      // Rahu/Ketu: treat the node as an ecliptic point at latitude 0.
      const eq=eclipticLonToEquatorial(p.tropical,date);
      const hor=A.Horizon(date,observer,eq.raHours,eq.decDeg,'normal');
      return {...p,az:normalize360(hor.azimuth),alt:hor.altitude};
    });
  }

  function localEclipticDirection(date,siderealLon,aya) {
    const tropical=normalize360(siderealLon+aya);
    const jd=julianDate(date);
    const T=(jd-2451545.0)/36525;
    const theta=localSiderealDegrees(date,state.origin.lng);
    const eps=meanObliquity(T);
    return {
      az:eclipticAzimuth(tropical,theta,state.origin.lat,eps),
      alt:eclipticAltitude(tropical,theta,state.origin.lat,eps)
    };
  }

  function eclipticLonToEquatorial(tropicalLon,date) {
    const T=(julianDate(date)-2451545.0)/36525;
    const eps=rad(meanObliquity(T));
    const lam=rad(tropicalLon);
    const ra=normalize360(deg(Math.atan2(Math.sin(lam)*Math.cos(eps),Math.cos(lam))));
    const dec=deg(Math.asin(Math.sin(eps)*Math.sin(lam)));
    return {raHours:ra/15,decDeg:dec};
  }

  function localSiderealDegrees(date,lonDeg) {
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

  function nakshatraInfo(lon) {
    const size=360/27;
    const x=normalize360(lon);
    const index=Math.floor(x/size);
    const within=x-index*size;
    const pada=Math.min(4,Math.floor(within/(size/4))+1);
    return {index,name:NAKSHATRAS[index],pada};
  }

  function azToCompass(az) {
    const names=['N','NE','E','SE','S','SW','W','NW'];
    return names[Math.round(normalize360(az)/45)%8];
  }

  function tropicalAscendant(date,latDeg,lonDeg) {
    const jd=julianDate(date);
    const T=(jd-2451545.0)/36525;
    const theta=normalize360(
      280.46061837+360.98564736629*(jd-2451545.0)+
      .000387933*T*T-(T*T*T)/38710000+lonDeg
    );
    const eps=meanObliquity(T);

    const roots=[];
    let prevLon=0, prevAlt=eclipticAltitude(0,theta,latDeg,eps);
    for(let lon=1;lon<=360;lon++){
      const alt=eclipticAltitude(lon%360,theta,latDeg,eps);
      if((prevAlt<=0&&alt>0)||(prevAlt>=0&&alt<0)){
        let a=prevLon,b=lon,fa=prevAlt;
        for(let i=0;i<42;i++){
          const m=(a+b)/2;
          const fm=eclipticAltitude(normalize360(m),theta,latDeg,eps);
          if((fa<=0&&fm<=0)||(fa>=0&&fm>=0)){a=m;fa=fm;} else b=m;
        }
        const root=normalize360((a+b)/2);
        roots.push({root,az:eclipticAzimuth(root,theta,latDeg,eps)});
      }
      prevLon=lon; prevAlt=alt;
    }
    roots.sort((a,b)=>angularDistance(a.az,90)-angularDistance(b.az,90));
    return roots[0]?.root ?? 0;
  }

  function eclipticAltitude(lambdaDeg,lstDeg,latDeg,epsDeg){
    const lam=rad(lambdaDeg),eps=rad(epsDeg),lat=rad(latDeg);
    const ra=Math.atan2(Math.sin(lam)*Math.cos(eps),Math.cos(lam));
    const dec=Math.asin(Math.sin(eps)*Math.sin(lam));
    const H=rad(normalize180(lstDeg-deg(ra)));
    return deg(Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H)));
  }

  function eclipticAzimuth(lambdaDeg,lstDeg,latDeg,epsDeg){
    const lam=rad(lambdaDeg),eps=rad(epsDeg),lat=rad(latDeg);
    const ra=Math.atan2(Math.sin(lam)*Math.cos(eps),Math.cos(lam));
    const dec=Math.asin(Math.sin(eps)*Math.sin(lam));
    const H=rad(normalize180(lstDeg-deg(ra)));
    const y=-Math.cos(dec)*Math.sin(H);
    const x=Math.sin(dec)*Math.cos(lat)-Math.cos(dec)*Math.sin(lat)*Math.cos(H);
    return normalize360(deg(Math.atan2(y,x)));
  }

  function lahiriAyanamsa(date){
    const jd=julianDate(date),T=(jd-2451545.0)/36525;
    return (85885.53+5028.796195*T+1.1054348*T*T+.00007964*T*T*T)/3600;
  }

  function meanAscendingNode(date){
    const T=(julianDate(date)-2451545)/36525;
    return normalize360(125.0445479-1934.1362891*T+.0020754*T*T+T*T*T/467441-T*T*T*T/60616000);
  }

  function meanObliquity(T){
    return (84381.448-46.815*T-.00059*T*T+.001813*T*T*T)/3600;
  }

  function julianDate(date){return date.getTime()/86400000+2440587.5;}
  function longitudeToBearing(lon,asc){return normalize360(90-normalize360(lon-asc));}

  function fullGreatCircle(bearing){
    const coords=[];
    for(let d=RAY_MAX_KM;d>=0;d-=RAY_STEP_KM)
      coords.push(destination(state.origin,normalize360(bearing+180),d));
    for(let d=RAY_STEP_KM;d<=RAY_MAX_KM;d+=RAY_STEP_KM)
      coords.push(destination(state.origin,bearing,d));
    return splitAntimeridian(coords);
  }

  function rayCoordinates(bearing,maxKm){
    const coords=[];
    for(let d=0;d<=maxKm;d+=RAY_STEP_KM) coords.push(destination(state.origin,bearing,d));
    return splitAntimeridian(coords);
  }

  function destination(origin,bearingDeg,distanceKm){
    const delta=distanceKm/EARTH_RADIUS_KM,theta=rad(bearingDeg);
    const phi1=rad(origin.lat),lambda1=rad(origin.lng);
    const sinPhi2=Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta);
    const phi2=Math.asin(clamp(sinPhi2,-1,1));
    const y=Math.sin(theta)*Math.sin(delta)*Math.cos(phi1);
    const x=Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2);
    const lambda2=lambda1+Math.atan2(y,x);
    return [normalizeLng(deg(lambda2)),deg(phi2)];
  }

  function splitAntimeridian(coords){
    const segments=[]; let current=[coords[0]];
    for(let i=1;i<coords.length;i++){
      if(Math.abs(coords[i][0]-coords[i-1][0])>180){
        if(current.length>1) segments.push(current);
        current=[coords[i]];
      } else current.push(coords[i]);
    }
    if(current.length>1) segments.push(current);
    return segments.length===1
      ? {type:'LineString',coordinates:segments[0]}
      : {type:'MultiLineString',coordinates:segments};
  }

  function lineFeature(geometry,properties={}){return {type:'Feature',geometry,properties};}
  function pointFeature(pos,properties={}){
    const coords=Array.isArray(pos)?pos:[pos.lng,pos.lat];
    return {type:'Feature',geometry:{type:'Point',coordinates:coords},properties};
  }
  function setData(id,features){map.getSource(id)?.setData({type:'FeatureCollection',features});}

  function zodiacDegree(lon){
    const x=normalize360(lon),s=Math.floor(x/30),w=x-s*30,d=Math.floor(w),m=Math.floor((w-d)*60);
    return `${SIGNS[s][1]} ${d}°${String(m).padStart(2,'0')}′`;
  }
  function shortDegree(lon){
    const x=normalize360(lon),s=Math.floor(x/30),w=x-s*30;
    return `${SIGNS[s][1]}${w.toFixed(1)}°`;
  }
  function degreeMinute(x){
    const d=Math.floor(x),m=Math.floor((x-d)*60),s=Math.round((((x-d)*60)-m)*60);
    return `${d}°${String(m).padStart(2,'0')}′${String(s).padStart(2,'0')}″`;
  }
  function normalize360(x){return ((x%360)+360)%360;}
  function normalize180(x){let y=normalize360(x);if(y>180)y-=360;return y;}
  function normalizeLng(x){return ((x+180)%360+360)%360-180;}
  function angularDistance(a,b){return Math.abs(normalize180(a-b));}
  function rad(d){return d*Math.PI/180;}
  function deg(r){return r*180/Math.PI;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function showToast(message){
    const t=document.getElementById('statusToast'); if(!t)return;
    t.textContent=message;t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'),2200);
  }

  return {
    refresh,
    play:startSimulation,
    pause:stopSimulation,
    getDate:getSimulationDate,
    setSpeed(speed){
      const current=getSimulationDate().getTime();
      state.simSpeed=Math.max(1,Number(speed)||1);
      state.simEpochAstro=current;
      state.simEpochReal=Date.now();
    }
  };
}
