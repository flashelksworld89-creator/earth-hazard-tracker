const SOURCE='https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv';

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  const pushField=()=>{row.push(field);field=''};
  const pushRow=()=>{pushField();rows.push(row);row=[]};
  const s=String(text||'');
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==='"'){
      if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted;
    }else if(ch===','&&!quoted)pushField();
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&s[i+1]==='\n')i++;
      if(row.length||field)pushRow();
    }else field+=ch;
  }
  if(row.length||field)pushRow();
  if(!rows.length)return [];
  const headers=rows.shift().map(h=>String(h||'').replace(/^\uFEFF/,''));
  return rows.filter(r=>r.some(v=>String(v||'').trim()!=='')).map(vals=>{
    const o={};headers.forEach((h,i)=>o[h]=vals[i]??'');return o;
  });
}
const num=v=>{const raw=String(v??'').trim();if(!raw)return null;const n=Number(raw);return Number.isFinite(n)?n:null};
function wind(row){
  const preferred=num(row.WMO_WIND);
  if(preferred!==null&&preferred>0)return preferred;
  const vals=['USA_WIND','TOKYO_WIND','CMA_WIND','HKO_WIND','NEWDELHI_WIND','REUNION_WIND','BOM_WIND','NADI_WIND','WELLINGTON_WIND']
    .map(k=>num(row[k])).filter(n=>n!==null&&n>0);
  return vals.length?Math.max(...vals):null;
}
function pressure(row){
  for(const k of ['WMO_PRES','USA_PRES','TOKYO_PRES','CMA_PRES','HKO_PRES','NEWDELHI_PRES','REUNION_PRES','BOM_PRES','NADI_PRES','WELLINGTON_PRES']){
    const n=num(row[k]);if(n!==null&&n>0)return n;
  }
  return null;
}
function category(k){
  if(k===null)return'Unknown';
  if(k>=137)return'Category 5';
  if(k>=113)return'Category 4';
  if(k>=96)return'Category 3';
  if(k>=83)return'Category 2';
  if(k>=64)return'Category 1';
  if(k>=34)return'Tropical Storm / Cyclonic Storm';
  return'Below tropical-storm strength';
}
function iso(row){const s=String(row.ISO_TIME||'').trim();return /^\d{4}-\d{2}-\d{2}/.test(s)?s.replace(' ','T')+'Z':null}
function midpoint(a,b){
  const ta=new Date(a).getTime(),tb=new Date(b).getTime();
  if(!Number.isFinite(ta)||!Number.isFinite(tb))return a;
  return new Date(ta+(tb-ta)/2).toISOString();
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const start=String(req.query?.start||'2025-01-01');
  const end=String(req.query?.end||new Date().toISOString().slice(0,10));
  try{
    const r=await fetch(SOURCE,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Landfall-Agent'}});
    if(!r.ok)throw new Error('IBTrACS HTTP '+r.status);
    const rows=parseCsv(await r.text()).filter(row=>{
      const t=iso(row); if(!t)return false;
      const day=t.slice(0,10); if(day<start||day>end)return false;
      const tt=String(row.TRACK_TYPE||'').toLowerCase();
      return !tt.includes('spur');
    });
    const byStorm=new Map();
    for(const row of rows){
      const sid=String(row.SID||'').trim(); if(!sid)continue;
      if(!byStorm.has(sid))byStorm.set(sid,[]);
      byStorm.get(sid).push(row);
    }
    const events=[];
    for(const [sid,track] of byStorm){
      track.sort((a,b)=>new Date(iso(a))-new Date(iso(b)));
      let inZeroRun=false;
      for(let i=0;i<track.length;i++){
        const row=track[i],lf=num(row.LANDFALL),dist=num(row.DIST2LAND),t=iso(row);
        if(lf!==0){inZeroRun=false;continue}
        if(inZeroRun)continue;
        inZeroRun=true;
        const next=track[i+1],nextTime=next?iso(next):null;
        const landfallAt=nextTime?midpoint(t,nextTime):t;
        const nextWind=next?wind(next):null;
        const winds=[wind(row),nextWind].filter(Number.isFinite);
        const w=winds.length?Math.max(...winds):null;
        const pressures=[pressure(row),next?pressure(next):null].filter(Number.isFinite);
        const p=pressures.length?Math.min(...pressures):null;
        if(w===null||w<34)continue;
        events.push({
          id:sid+'-'+t,
          sid,
          name:String(row.NAME||'UNNAMED').trim()||'UNNAMED',
          basin:String(row.BASIN||'').trim(),
          landfallAt,
          windowStart:t,
          windowEnd:nextTime,
          lat:num(row.LAT),
          lon:num(row.LON),
          windKt:w,
          pressureMb:p,
          category:category(w),
          dist2landKm:dist,
          nature:String(row.NATURE||'').trim(),
          landfallFlag:lf,
          source:'NOAA IBTrACS v04r01'
        });
      }
    }
    events.sort((a,b)=>new Date(b.landfallAt)-new Date(a.landfallAt));
    res.status(200).json({ok:true,start,end,count:events.length,events,source:SOURCE,fetchedAt:new Date().toISOString(),method:'Distinct valid LANDFALL=0 runs only; blank numeric cells are excluded; intensity uses WMO wind when present and otherwise strongest available agency wind across the landfall interval; timestamp is the midpoint of the IBTrACS crossing window'});
  }catch(error){
    res.status(502).json({ok:false,error:String(error?.message||error),events:[]});
  }
}