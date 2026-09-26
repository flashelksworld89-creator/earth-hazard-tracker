import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';

const INDEX='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';

function eventIso(row){
  const ym=String(row.BEGIN_YEARMONTH||''),day=Number(row.BEGIN_DAY),hhmm=String(row.BEGIN_TIME||'0').padStart(4,'0');
  if(!/^\d{6}$/.test(ym)||!day)return null;
  const y=Number(ym.slice(0,4)),m=Number(ym.slice(4,6)),hh=Number(hhmm.slice(0,2)),mm=Number(hhmm.slice(2,4));
  const mt=String(row.CZ_TIMEZONE||'').match(/([+-]?\d+)$/),offset=mt?Number(mt[1]):0;
  return new Date(Date.UTC(y,m-1,day,hh-offset,mm,0,0)).toISOString();
}
function extractRain(text){
  const s=String(text||'').replace(/,/g,' ');let best=null;
  const rs=[/(?:rainfall|rain|precipitation|amounts?|total(?:ed|ing)?)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")/gi,/(\d+(?:\.\d+)?)\s*(?:to|[-–])\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")\s*(?:of\s+)?(?:rain|rainfall|precipitation)/gi,/(?:rainfall|rain|precipitation|amounts?|total(?:ed|ing)?)[^\d]{0,35}(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")/gi,/(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|")\s*(?:of\s+)?(?:rain|rainfall|precipitation)/gi];
  for(const re of rs){let m;while((m=re.exec(s))){const vals=m.slice(1).filter(Boolean).map(Number).filter(Number.isFinite);if(vals.length){const v=Math.max(...vals);if(v<=100&&(best===null||v>best))best=v}}}
  return best;
}
function qualifies(row){
  const type=String(row.EVENT_TYPE||'').trim(),cause=String(row.FLOOD_CAUSE||'').toLowerCase();
  return type==='Heavy Rain'||((type==='Flash Flood'||type==='Flood')&&cause.includes('heavy rain'));
}
async function latestFile(year){
  const r=await fetch(INDEX,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Weather-Agent'}});
  if(!r.ok)throw new Error('Storm Events index HTTP '+r.status);
  const html=await r.text(),re=new RegExp('StormEvents_details-ftp_v1\\.0_d'+year+'_c(\\d{8})\\.csv\\.gz','g'),found=[];let m;
  while((m=re.exec(html)))found.push({name:m[0],stamp:m[1]});
  found.sort((a,b)=>b.stamp.localeCompare(a.stamp));
  if(!found.length)throw new Error('No Storm Events file for '+year);
  return found[0].name;
}
function rowFrom(headers,vals){const o={};headers.forEach((h,i)=>o[h]=vals[i]??'');return o}
async function streamCsv(readable,onRow){
  let headers=null,row=[],field='',quoted=false;
  const pushField=()=>{row.push(field);field=''};
  const finishRow=async()=>{pushField();if(!headers)headers=row.map(h=>String(h||'').replace(/^\uFEFF/,''));else if(row.some(v=>String(v||'').trim()!==''))await onRow(rowFrom(headers,row));row=[]};
  for await(const chunk of readable){
    const s=chunk.toString('utf8');
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(ch==='"'){
        if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted;
      }else if(ch===','&&!quoted){pushField()}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&s[i+1]==='\n')i++;
        await finishRow();
      }else field+=ch;
    }
  }
  if(field||row.length)await finishRow();
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const year=Number(req.query?.year||new Date().getUTCFullYear());
  try{
    const file=await latestFile(year),url=INDEX+file,r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Weather-Agent'}});
    if(!r.ok)throw new Error('Storm Events HTTP '+r.status);
    if(!r.body)throw new Error('Storm Events response body unavailable');
    const events=[];let latestEventAt=null,scanned=0;
    const gunzip=Readable.fromWeb(r.body).pipe(createGunzip());
    await streamCsv(gunzip,async row=>{
      scanned++;
      if(!qualifies(row))return;
      const eventAt=eventIso(row);if(!eventAt||new Date(eventAt)>new Date())return;
      const narrative=(String(row.EVENT_NARRATIVE||'')+' '+String(row.EPISODE_NARRATIVE||'')).trim(),rainfallInches=extractRain(narrative);
      events.push({id:'NCEI-'+String(row.EVENT_ID||''),type:'Heavy Rain',eventType:String(row.EVENT_TYPE||'Heavy Rain'),eventAt,state:String(row.STATE||''),area:String(row.CZ_NAME||''),lat:Number(row.BEGIN_LAT)||null,lon:Number(row.BEGIN_LON)||null,rainfallInches,intensityValue:rainfallInches,intensityUnit:rainfallInches!==null?'in':'',source:'NOAA/NWS Storm Events',narrative:narrative.slice(0,700)});
      if(!latestEventAt||eventAt>latestEventAt)latestEventAt=eventAt;
    });
    events.sort((a,b)=>(b.rainfallInches??-1)-(a.rainfallInches??-1));
    res.status(200).json({ok:true,year,count:events.length,measuredCount:events.filter(x=>x.rainfallInches!==null).length,latestEventAt,scannedRows:scanned,events,source:url,fetchedAt:new Date().toISOString()});
  }catch(error){
    res.status(502).json({ok:false,year,error:String(error?.message||error),events:[]});
  }
}