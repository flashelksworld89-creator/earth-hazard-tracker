import { gunzipSync } from 'node:zlib';
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

const INDEX='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';
function eventIso(row){
  const ym=String(row.BEGIN_YEARMONTH||''),day=Number(row.BEGIN_DAY),hhmm=String(row.BEGIN_TIME||'0').padStart(4,'0');if(!/^\d{6}$/.test(ym)||!day)return null;
  const y=Number(ym.slice(0,4)),m=Number(ym.slice(4,6)),hh=Number(hhmm.slice(0,2)),mm=Number(hhmm.slice(2,4)),mt=String(row.CZ_TIMEZONE||'').match(/([+-]?\d+)$/),offset=mt?Number(mt[1]):0;
  return new Date(Date.UTC(y,m-1,day,hh-offset,mm,0,0)).toISOString();
}
function extractRain(text){
  const s=String(text||'').replace(/,/g,' ');let best=null;
  const rs=[/(?:rainfall|rain|precipitation|amounts?|total(?:ed|ing)?)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")/gi,/(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")\s*(?:of\s+)?(?:rain|rainfall|precipitation)/gi,/(?:rainfall|rain|precipitation|amounts?|total(?:ed|ing)?)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")/gi,/(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")\s*(?:of\s+)?(?:rain|rainfall|precipitation)/gi];
  for(const re of rs){let m;while((m=re.exec(s))){const vals=m.slice(1).filter(Boolean).map(Number).filter(Number.isFinite);if(vals.length){const v=Math.max(...vals);if(v<=100&&(best===null||v>best))best=v}}}return best;
}
async function latestFile(year){
  const r=await fetch(INDEX,{cache:'no-store'});if(!r.ok)throw new Error('Storm Events index HTTP '+r.status);
  const html=await r.text(),re=new RegExp('StormEvents_details-ftp_v1\\.0_d'+year+'_c(\\d{8})\\.csv\\.gz','g'),found=[];let m;
  while((m=re.exec(html)))found.push({name:m[0],stamp:m[1]});found.sort((a,b)=>b.stamp.localeCompare(a.stamp));if(!found.length)throw new Error('No Storm Events file for '+year);return found[0].name;
}
function qualifies(row){const type=String(row.EVENT_TYPE||'').trim(),cause=String(row.FLOOD_CAUSE||'').toLowerCase();return type==='Heavy Rain'||((type==='Flash Flood'||type==='Flood')&&cause.includes('heavy rain'))}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');const year=Number(req.query?.year||new Date().getUTCFullYear());
  try{
    const file=await latestFile(year),url=INDEX+file,r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Storm Events HTTP '+r.status);
    const gz=Buffer.from(await r.arrayBuffer()),rows=csvRows(gunzipSync(gz).toString('utf8')),events=[];let latestEventAt=null;
    for(const row of rows){if(!qualifies(row))continue;const eventAt=eventIso(row);if(!eventAt||new Date(eventAt)>new Date())continue;const narrative=(String(row.EVENT_NARRATIVE||'')+' '+String(row.EPISODE_NARRATIVE||'')).trim(),rainfallInches=extractRain(narrative);
      events.push({id:'NCEI-'+String(row.EVENT_ID||''),type:'Heavy Rain',eventType:String(row.EVENT_TYPE||'Heavy Rain'),eventAt,state:String(row.STATE||''),area:String(row.CZ_NAME||''),lat:Number(row.BEGIN_LAT)||null,lon:Number(row.BEGIN_LON)||null,rainfallInches,intensityValue:rainfallInches,intensityUnit:rainfallInches!==null?'in':'',source:'NOAA/NWS Storm Events',narrative:narrative.slice(0,700)});if(!latestEventAt||eventAt>latestEventAt)latestEventAt=eventAt}
    events.sort((a,b)=>(b.rainfallInches??-1)-(a.rainfallInches??-1));res.status(200).json({ok:true,year,count:events.length,measuredCount:events.filter(x=>x.rainfallInches!==null).length,latestEventAt,events,source:url,fetchedAt:new Date().toISOString()});
  }catch(error){res.status(502).json({ok:false,error:String(error?.message||error),events:[]})}
}