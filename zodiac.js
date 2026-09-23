const EARTH_RADIUS_KM = 6371.0088;
const RAY_MAX_KM = 19800;
const RAY_STEP_KM = 180;

const SIGNS = [
  ['Aries','♈'], ['Taurus','♉'], ['Gemini','♊'], ['Cancer','♋'],
  ['Leo','♌'], ['Virgo','♍'], ['Libra','♎'], ['Scorpio','♏'],
  ['Sagittarius','♐'], ['Capricorn','♑'], ['Aquarius','♒'], ['Pisces','♓']
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
  'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
  'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha',
  'Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada',
  'Uttara Bhadrapada','Revati'
];

const PLANET_META = [
  ['Sun','☉'], ['Moon','☽'], ['Mercury','☿'], ['Venus','♀'], ['Mars','♂'],
  ['Jupiter','♃'], ['Saturn','♄'], ['Uranus','♅'], ['Neptune','♆'], ['Pluto','♇']
];

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
    origin:'zodiac-origin'
  };

  try {
    addSourcesAndLayers();
    bindControls();
    const toggle = document.getElementById('zodiacLayerToggle');
    if (toggle) toggle.checked = true;
    const panel = document.getElementById('zodiacPanel');
    if (panel) panel.classList.remove('hidden');
    state.enabled = true;
    refresh();
    setVisibility();
    document.getElementById('zodiacStatus').textContent = 'Ready · Sidereal · Lahiri';
  } catch (err) {
    console.error('Zodiacal Compass init error:', err);
    showVisibleError(err);
  }

  setInterval(() => {
    if (state.enabled && state.timeOffsetMs === 0) refresh();
  }, 60_000);

  function bindControls() {
    const toggle = document.getElementById('zodiacLayerToggle');
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
        state.timeOffsetMs += Number(btn.dataset.ztime) * 60000;
        refresh();
      });
    });

    document.getElementById('zNowBtn').addEventListener('click', () => {
      state.timeOffsetMs = 0;
      refresh();
    });

    document.getElementById('zOpacity').addEventListener('input', (e) => {
      state.opacity = Number(e.target.value)/100;
      updateOpacity();
    });

    document.getElementById('zPlanetSelect').addEventListener('change', (e) => {
      state.highlightedPlanet = e.target.value;
      redrawPlanets();
    });
  }

  function addSourcesAndLayers() {
    const empty = {type:'FeatureCollection',features:[]};
    Object.values(ids).forEach(id => {
      if (!map.getSource(id)) map.addSource(id,{type:'geojson',data:empty});
    });

    addLine(ids.nak,'#67e8f9',1.25,.48,[2,3]);
    addLine(ids.signs,'#f0abfc',3.0,.90);
    addLine(ids.houses,'#fde68a',1.8,.76,[5,3]);
    addLine(ids.dirs,'#cbd5e1',1.3,.56,[1,4]);

    if (!map.getLayer(ids.planetLines)) map.addLayer({
      id:ids.planetLines,type:'line',source:ids.planetLines,
      paint:{
        'line-color':['case',['==',['get','highlighted'],true],'#ffffff','#c084fc'],
        'line-width':['case',['==',['get','highlighted'],true],4,1.6],
        'line-opacity':.85
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
          ['==',['get','kind'],'sign'],'#f5d0fe',
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
        'text-color':['case',['==',['get','highlighted'],true],'#ffffff','#e9d5ff'],
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
      const date = new Date(Date.now()+state.timeOffsetMs);
      state.origin.lat = clamp(state.origin.lat,-89,89);
      state.origin.lng = normalizeLng(state.origin.lng);

      const aya = lahiriAyanamsa(date);
      const asc = normalize360(tropicalAscendant(date,state.origin.lat,state.origin.lng)-aya);
      const dsc = normalize360(asc+180);
      const placements = computeApproxPlanetLongitudes(date,aya);

      state.lastData={date,aya,asc,dsc,placements};

      document.getElementById('zAsc').textContent=zodiacDegree(asc);
      document.getElementById('zDsc').textContent=zodiacDegree(dsc);
      document.getElementById('zAya').textContent=degreeMinute(aya);
      document.getElementById('zTimeLabel').textContent=date.toLocaleString();
      document.getElementById('zOriginLabel').textContent=
        `Origin: ${state.origin.lat.toFixed(4)}°, ${state.origin.lng.toFixed(4)}°`;
      document.getElementById('zodiacStatus').textContent='Sidereal · Lahiri · Great-circle';

      drawGeometry(asc);
      redrawPlanets();
      updatePlanetList(placements);
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
  }

  function updateOpacity() {
    const pairs=[
      [ids.signs,'line-opacity',.78],
      [ids.nak,'line-opacity',.42],
      [ids.houses,'line-opacity',.65],
      [ids.dirs,'line-opacity',.48],
      [ids.planetLines,'line-opacity',.88]
    ];
    pairs.forEach(([id,prop,base])=>{
      if(map.getLayer(id)) map.setPaintProperty(id,prop,base*state.opacity);
    });
    if(map.getLayer(ids.labels)) map.setPaintProperty(ids.labels,'text-opacity',state.opacity);
    if(map.getLayer(ids.planets)) map.setPaintProperty(ids.planets,'text-opacity',state.opacity);
  }

  function drawGeometry(asc) {
    const signs=[],nak=[],houses=[],dirs=[],labels=[];

    for(let i=0;i<12;i++){
      const lon=i*30;
      signs.push(lineFeature(fullGreatCircle(longitudeToBearing(lon,asc)),{kind:'sign'}));
      const pos=destination(state.origin,longitudeToBearing(lon+15,asc),10500);
      labels.push(pointFeature(pos,{kind:'sign',label:`${SIGNS[i][1]} ${SIGNS[i][0]}`}));
    }

    const nsize=360/27;
    for(let i=0;i<27;i++){
      const lon=i*nsize;
      nak.push(lineFeature(fullGreatCircle(longitudeToBearing(lon,asc)),{kind:'nak'}));
      const pos=destination(state.origin,longitudeToBearing(lon+nsize/2,asc),i%2?7600:6900);
      labels.push(pointFeature(pos,{kind:'nak',label:NAKSHATRAS[i]}));
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

  function redrawPlanets() {
    if(!state.lastData) return;
    const {asc,placements}=state.lastData;
    const lines=[],points=[];
    placements.forEach(p=>{
      const b=longitudeToBearing(p.lon,asc);
      const highlighted=state.highlightedPlanet===p.name;
      lines.push(lineFeature(rayCoordinates(b,highlighted?15000:11800),
        {name:p.name,highlighted}));
      points.push(pointFeature(destination(state.origin,b,highlighted?9200:8500),
        {name:p.name,highlighted,label:`${p.glyph} ${p.name} ${shortDegree(p.lon)}`}));
    });
    setData(ids.planetLines,lines);
    setData(ids.planets,points);
  }

  function updatePlanetList(placements) {
    document.getElementById('zPlanetList').innerHTML=placements.map(p=>
      `<div class="z-planet-item"><b>${p.glyph} ${p.name}</b><span>${zodiacDegree(p.lon)}</span></div>`
    ).join('');
  }

  function computeApproxPlanetLongitudes(date,aya) {
    const d=julianDate(date)-2451545.0;
    const vals=[];

    // Compact low-precision heliocentric/geocentric approximation sufficient to render.
    // Rates are mean tropical ecliptic longitudes; outer planets use mean motion.
    const mean = {
      Sun:280.46646 + .98564736*d,
      Moon:218.316 + 13.176396*d,
      Mercury:252.251 + 4.09233445*d,
      Venus:181.980 + 1.60213034*d,
      Mars:355.433 + .52402068*d,
      Jupiter:34.351 + .08308529*d,
      Saturn:50.077 + .03344414*d,
      Uranus:314.055 + .01172834*d,
      Neptune:304.348 + .00598103*d,
      Pluto:238.929 + .003964*d
    };

    PLANET_META.forEach(([name,glyph])=>{
      let lon=mean[name];
      if(name==='Sun') lon += 1.915*Math.sin(rad(357.529+.98560028*d));
      if(name==='Moon') lon += 6.289*Math.sin(rad(134.963+13.064993*d));
      vals.push({name,glyph,lon:normalize360(lon-aya)});
    });

    const rahu=normalize360(meanAscendingNode(date)-aya);
    vals.push({name:'Rahu',glyph:'☊',lon:rahu});
    vals.push({name:'Ketu',glyph:'☋',lon:normalize360(rahu+180)});
    return vals;
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

  return {refresh};
}
