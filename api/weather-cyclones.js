function parseCsvLine(line){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted;
    }else if(ch===','&&!quoted){out.push(cur);cur=''}else cur+=ch;
  }
  out.push(cur);return out;
}
function csvRows(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').filter(Boolean);
  if(!lines.length)return [];
  const headers=parseCsvLine(lines[0]);
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const vals=parseCsvLine(lines[i]);if(vals.length<2)continue;
    const row={};headers.forEach((h,j)=>row[h]=vals[j]??'');rows.push(row);
  }
  return rows;
}

const SOURCE='https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
function firstNum(row,keys){for(const k of keys){const n=num(row[k]);if(n!==null&&n>=0)return n}return null}
function wind(row){return firstNum(row,['WMO_WIND','USA_WIND','TOKYO_WIND','CMA_WIND','HKO_WIND','NEWDELHI_WIND','REUNION_WIND','BOM_WIND','NADI_WIND','WELLINGTON_WIND'])}
function pressure(row){return firstNum(row,['WMO_PRES','USA_PRES','TOKYO_PRES','CMA_PRES','HKO_PRES','NEWDELHI_PRES','REUNION_PRES','BOM_PRES','NADI_PRES','WELLINGTON_PRES'])}
function category(k){if(k>=137)return'Category 5';if(k>=113)return'Category 4';if(k>=96)return'Category 3';if(k>=83)return'Category 2';if(k>=64)return'Category 1';return'Below hurricane strength'}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const start=String(req.query?.start||'2025-01-01'),end=String(req.query?.end||new Date().toISOString().slice(0,10));
  try{
    const r=await fetch(SOURCE,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Weather-Agent'}});
    if(!r.ok)throw new Error('IBTrACS HTTP '+r.status);
    const rows=csvRows(await r.text()),storms=new Map();
    for(const row of rows){
      const iso=String(row.ISO_TIME||'').trim();if(!/^\d{4}-\d{2}-\d{2}/.test(iso))continue;
      const day=iso.slice(0,10);if(day<start||day>end)continue;
      const sid=String(row.SID||'').trim();if(!sid)continue;
      const w=wind(row),p=pressure(row),ts=iso.replace(' ','T')+'Z';
      const s=storms.get(sid)||{id:sid,name:String(row.NAME||'UNNAMED').trim()||'UNNAMED',basin:String(row.BASIN||'').trim(),startAt:null,endAt:null,maxWindKt:null,minPressureMb:null,peakAt:null,lat:null,lon:null};
      if(!s.startAt||ts<s.startAt)s.startAt=ts;if(!s.endAt||ts>s.endAt)s.endAt=ts;
      if(w!==null&&(s.maxWindKt===null||w>s.maxWindKt)){s.maxWindKt=w;s.peakAt=ts;s.lat=num(row.LAT);s.lon=num(row.LON)}
      if(p!==null&&(s.minPressureMb===null||p<s.minPressureMb))s.minPressureMb=p;storms.set(sid,s);
    }
    const events=[...storms.values()].filter(s=>s.maxWindKt>=64&&s.peakAt).map(s=>({...s,type:'Tropical Cyclone',category:category(s.maxWindKt),intensityValue:s.maxWindKt,intensityUnit:'kt',source:'NOAA IBTrACS v04r01'})).sort((a,b)=>b.maxWindKt-a.maxWindKt);
    res.status(200).json({ok:true,start,end,count:events.length,events,source:SOURCE,fetchedAt:new Date().toISOString()});
  }catch(error){res.status(502).json({ok:false,error:String(error?.message||error),events:[]})}
}