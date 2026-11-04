/* Date-only, exploratory aviation/Moon aspect comparison. No causal or predictive claims. */
(function(){
'use strict';
const bodies=['Sun','Mercury','Venus','Mars','Jupiter','Saturn','Rahu','Ketu','Uranus','Neptune','Pluto'];
const cache=new Map();
const utcDate=(day,hour)=>new Date(day+'T'+hour+'Z');
function snapshot(day,hour='12:00:00'){
  const key=day+'|'+hour;
  if(cache.has(key))return cache.get(key);
  const astro=calculateAstro(utcDate(day,hour));
  const lon=astro.PlanetLongitudes;
  const sign=n=>Math.floor(norm(n)/30);
  const vedic=new Set(),modern=new Set();
  for(const planet of bodies){
    const offset=(sign(lon.Moon)-sign(lon[planet])+12)%12;
    const houses=planet==='Mars'?[3,6,7]:planet==='Saturn'?[2,6,9]:planet==='Jupiter'?[4,6,8]:[6];
    // Nodes: seventh aspect only; disputed fifth/ninth node drishti excluded.
    if(houses.includes(offset))vedic.add(planet+' → Moon · '+(offset+1)+'th sign aspect');
    const aspect=aspectRecord(planet,lon[planet],lon.Moon);
    if(aspect.major)modern.add(planet+' ↔ Moon · '+aspect.aspect);
  }
  const result={vedic,modern,moonSign:sign(lon.Moon)};
  cache.set(key,result);return result;
}
function render(){
  const target=document.getElementById('aspectComparison');
  if(!target)return;
  if(typeof A==='undefined'||!A){target.textContent='Ephemeris unavailable.';return}
  const mode=document.getElementById('aspectSystem').value;
  const kind=document.getElementById('aspectIncidentType').value;
  const start='2026-01-01';
  const today=new Date().toISOString().slice(0,10);
  const end=today<'2026-12-31'?today:'2026-12-31';
  const days=dateRange(start,end);
  const filtered=countedIncidents.filter(r=>{
    const day=String(r.eventAt||'').slice(0,10);
    if(day<start||day>end)return false;
    const categories=Array.isArray(r.categories)?r.categories:[];
    if(kind==='crash')return categories.includes('Crash / Collision');
    if(kind==='emergency')return !categories.includes('Crash / Collision');
    return true;
  });
  if(!filtered.length){target.innerHTML='<p>No 2026 incidents in this category yet.</p>';return}
  const baseline=new Map(),observed=new Map(),uncertain=new Map();
  const increment=(map,key,n=1)=>map.set(key,(map.get(key)||0)+n);
  for(const day of days){
    const s=snapshot(day)[mode];
    for(const key of s)increment(baseline,key);
  }
  let included=0;
  for(const r of filtered){
    const day=String(r.eventAt).slice(0,10);
    const s=snapshot(day)[mode];included++;
    for(const key of s){
      increment(observed,key);
      if(r.timeConfidence!=='reported'){
        const morning=snapshot(day,'00:00:00')[mode];
        const evening=snapshot(day,'23:59:59')[mode];
        if(!morning.has(key)||!evening.has(key))increment(uncertain,key);
      }
    }
  }
  const rows=[...observed].map(([key,count])=>{
    const baselineDays=baseline.get(key)||0;
    const expected=baselineDays/days.length;
    return {key,count,baselineDays,rate:count/included,expected,ratio:expected?count/included/expected:0,uncertain:uncertain.get(key)||0};
  }).filter(x=>x.count>=5&&x.baselineDays>=3).sort((a,b)=>b.ratio-a.ratio||b.count-a.count);
  const body=rows.slice(0,25).map(x=>'<tr><td>'+esc(x.key)+'</td><td>'+x.count+'</td><td>'+((x.rate)*100).toFixed(1)+'%</td><td>'+(x.expected*100).toFixed(1)+'%</td><td>'+x.ratio.toFixed(2)+'×</td><td>'+x.uncertain+'</td></tr>').join('');
  const signObserved=Array(12).fill(0),signDays=Array(12).fill(0);
  for(const day of days)signDays[snapshot(day).moonSign]++;
  for(const r of filtered)signObserved[snapshot(String(r.eventAt).slice(0,10)).moonSign]++;
  const signs=signObserved.map((n,i)=>({i,n,expected:signDays[i]/days.length,ratio:signDays[i]?n/included/(signDays[i]/days.length):0})).sort((a,b)=>b.ratio-a.ratio);
  target.innerHTML='<div class="note">2026 UTC date-only comparison · '+included+' recorded incidents · '+days.length+' calendar days. Aspect rankings require at least five incident matches and three baseline days. An enrichment ratio above 1 means the aspect is more common among recorded incidents than among sampled calendar days, not that it increases aviation risk. Dates with multiple incidents count multiple times. News coverage, reporting bias, and missing incident times limit interpretation.</div>'+
    '<div class="table-wrap"><table class="dataset"><thead><tr><th>Moon aspect</th><th>Incidents</th><th>Incident share</th><th>Day baseline</th><th>Enrichment</th><th>Time-sensitive*</th></tr></thead><tbody>'+(body||'<tr><td colspan="6">Not enough matches for a ranked aspect.</td></tr>')+'</tbody></table></div>'+
    '<h3 style="margin:18px 0 8px">MOON SIGN · EXPOSURE-ADJUSTED COMPARISON</h3>'+
    '<div class="table-wrap"><table class="dataset"><thead><tr><th>Sidereal Moon sign</th><th>Incidents</th><th>Calendar-day share</th><th>Enrichment</th></tr></thead><tbody>'+signs.map(x=>'<tr><td>'+esc(SIGNS[x.i])+'</td><td>'+x.n+'</td><td>'+(100*x.expected).toFixed(1)+'%</td><td>'+x.ratio.toFixed(2)+'×</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="note">*Time-sensitive counts indicate records without a reported event time where the noon aspect is absent at midnight or end-of-day UTC. Noon is a consistent reference, not an assumed incident hour. Classical mode uses sign-based Parashari aspects (including Saturn third/tenth, Jupiter fifth/ninth, Mars fourth/eighth); nodes use seventh only. Modern mode uses conjunction, sextile, square, trine and opposition within eight degrees. Do not interpret these exploratory correlations as predictions.</div>';
}
window.renderAviationAspectComparison=render;
})();