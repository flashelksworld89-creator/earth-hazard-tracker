import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';

const INDEX='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';

const num=v=>{const raw=String(v??'').trim();if(!raw)return null;const n=Number(raw);return Number.isFinite(n)?n:null};

function timestamp(row,prefix='BEGIN'){
  const ym=String(row[prefix+'_YEARMONTH']||''),day=Number(row[prefix+'_DAY']),hhmm=String(row[prefix+'_TIME']||'0').padStart(4,'0');
  if(!/^\d{6}$/.test(ym)||!day)return null;
  const y=Number(ym.slice(0,4)),m=Number(ym.slice(4,6)),hh=Number(hhmm.slice(0,2)),mm=Number(hhmm.slice(2,4));
  const mt=String(row.CZ_TIMEZONE||'').match(/([+-]?\d+)$/),offset=mt?Number(mt[1]):0;
  return new Date(Date.UTC(y,m-1,day,hh-offset,mm,0,0)).toISOString();
}
async function latestFile(year){
  const r=await fetch(INDEX,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Convective-Agent'}});
  if(!r.ok)throw new Error('Storm Events index HTTP '+r.status);
  const html=await r.text(),re=new RegExp('StormEvents_details-ftp_v1\\.0_d'+year+'_c(\\d{8})\\.csv\\.gz','g'),found=[];let m;
  while((m=re.exec(html)))found.push({name:m[0],stamp:m[1]});
  found.sort((a,b)=>b.stamp.localeCompare(a.stamp));
  if(!found.length)throw new Error('No Storm Events file for '+year);
  return found[0].name;
}
function isConvective(row){
  const t=String(row.EVENT_TYPE||'').trim();
  return t==='Thunderstorm Wind'||t==='Hail';
}
function mcsTag(text){
  const s=String(text||'');
  if(/\bmesoscale convective (?:system|complex)\b/i.test(s))return'MCS';
  if(/\bMCS\b/i.test(s))return'MCS';
  if(/\bMCC\b/i.test(s))return'MCC';
  if(/\bQLCS\b/i.test(s))return'QLCS';
  if(/\bsquall line\b/i.test(s))return'Squall line';
  if(/\bderecho\b/i.test(s))return'Derecho';
  return null;
}
function severity(row){
  const type=String(row.EVENT_TYPE||'').trim(),mag=num(row.MAGNITUDE);
  if(mag===null)return{score:0,mag:null,unit:''};
  if(type==='Thunderstorm Wind')return{score:mag/50,mag,unit:'kt'};
  if(type==='Hail')return{score:mag,mag,unit:'in'};
  return{score:0,mag,unit:''};
}
function rowObject(headers,values){
  const o={};for(let i=0;i<headers.length;i++)o[headers[i]]=values[i]??'';return o;
}
async function streamCsv(readable,onRow){
  let headers=null,row=[],field='',quoted=false,pendingQuote=false;
  const finishField=()=>{row.push(field);field=''};
  const finishRow=async()=>{
    finishField();
    if(!headers)headers=row.map(h=>String(h||'').replace(/^\uFEFF/,''));
    else if(row.some(v=>String(v||'').trim()!==''))await onRow(rowObject(headers,row));
    row=[];
  };
  for await(const chunk of readable){
    const s=chunk.toString('utf8');
    for(let i=0;i<s.length;i++){
      const ch=s[i];

      if(pendingQuote){
        pendingQuote=false;
        if(ch==='"'){field+='"';continue}
        quoted=false;
        // fall through and process current character outside the quote
      }

      if(ch==='"'){
        if(quoted){
          if(i+1<s.length){
            if(s[i+1]==='"'){field+='"';i++}
            else quoted=false;
          }else{
            pendingQuote=true;
          }
        }else{
          quoted=true;
        }
      }else if(ch===','&&!quoted){
        finishField();
      }else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&s[i+1]==='\n')i++;
        if(row.length||field)await finishRow();
      }else{
        field+=ch;
      }
    }
  }
  if(pendingQuote){quoted=false;pendingQuote=false}
  if(row.length||field)await finishRow();
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const year=Number(req.query?.year||new Date().getUTCFullYear());
  try{
    const file=await latestFile(year),url=INDEX+file;
    const r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'Earth-Hazard-Tracker/Convective-Agent'}});
    if(!r.ok)throw new Error('Storm Events HTTP '+r.status);
    if(!r.body)throw new Error('Storm Events response body unavailable');

    const episodes=new Map();let scanned=0,matched=0;
    const gunzip=Readable.fromWeb(r.body).pipe(createGunzip());

    await streamCsv(gunzip,async row=>{
      scanned++;
      if(!isConvective(row))return;
      matched++;
      const at=timestamp(row,'BEGIN');if(!at||new Date(at)>new Date())return;
      const id=String(row.EPISODE_ID||'').trim();if(!id)return;

      const sev=severity(row);
      const narrative=(String(row.EPISODE_NARRATIVE||'')+' '+String(row.EVENT_NARRATIVE||'')).trim();
      const state=String(row.STATE||'').trim(),tag=mcsTag(narrative);

      const e=episodes.get(id)||{
        id:'NCEI-EP-'+id,episodeId:id,startAt:at,endAt:timestamp(row,'END')||at,peakAt:at,
        peakType:String(row.EVENT_TYPE||''),peakMagnitude:sev.mag,peakUnit:sev.unit,peakScore:sev.score,
        maxWindKt:null,maxHailIn:null,reportCount:0,states:[],mcsTag:null,narrative:'',source:'NOAA/NWS Storm Events'
      };

      e.reportCount++;
      if(state&&!e.states.includes(state))e.states.push(state);
      if(at<e.startAt)e.startAt=at;
      const endAt=timestamp(row,'END')||at;if(endAt>e.endAt)e.endAt=endAt;
      if(String(row.EVENT_TYPE||'')==='Thunderstorm Wind'&&sev.mag!==null&&(e.maxWindKt===null||sev.mag>e.maxWindKt))e.maxWindKt=sev.mag;
      if(String(row.EVENT_TYPE||'')==='Hail'&&sev.mag!==null&&(e.maxHailIn===null||sev.mag>e.maxHailIn))e.maxHailIn=sev.mag;
      if(sev.score>e.peakScore){e.peakScore=sev.score;e.peakAt=at;e.peakType=String(row.EVENT_TYPE||'');e.peakMagnitude=sev.mag;e.peakUnit=sev.unit}
      if(tag&&!e.mcsTag)e.mcsTag=tag;
      if(narrative.length>e.narrative.length)e.narrative=narrative.slice(0,900);
      episodes.set(id,e);
    });

    const events=[...episodes.values()].filter(e=>e.reportCount>0).sort((a,b)=>new Date(b.peakAt)-new Date(a.peakAt));
    return res.status(200).json({
      ok:true,year,count:events.length,mcsTagged:events.filter(e=>e.mcsTag).length,
      scannedRows:scanned,convectiveRows:matched,events,source:url,fetchedAt:new Date().toISOString(),
      coverageNote:'Storm Events is quality-controlled and may lag the present date.'
    });
  }catch(error){
    return res.status(502).json({ok:false,year,error:String(error?.message||error),events:[]});
  }
}
