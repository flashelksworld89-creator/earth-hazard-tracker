import { fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';

const HRAP='+proj=stere +lat_0=90 +lat_ts=60 +lon_0=-105 +x_0=0 +y_0=0 +R=6371200 +units=m +no_defs';
const WGS84='+proj=longlat +datum=WGS84 +no_defs';

function urlFor(date){
  const [y,m,d]=date.split('-');
  const ymd=y+m+d;
  return `https://water.noaa.gov/resources/downloads/precip/stageIV/${y}/${m}/${d}/nws_precip_1day_${ymd}_conus.tif`;
}
function validDate(s){return /^20\d\d-\d\d-\d\d$/.test(s)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=31536000, immutable');
  const date=String(req.query?.date||'');
  const lat=Number(req.query?.lat),lon=Number(req.query?.lon);
  if(!validDate(date)||!Number.isFinite(lat)||!Number.isFinite(lon))return res.status(400).json({ok:false,error:'date, lat and lon are required'});
  if(lat<18||lat>55||lon<-135||lon>-55)return res.status(200).json({ok:false,outsideConus:true,date,lat,lon});
  const source=urlFor(date);
  try{
    const r=await fetch(source,{cache:'force-cache',headers:{'User-Agent':'Earth-Hazard-Tracker/1.19'}});
    if(!r.ok)throw new Error('Stage IV HTTP '+r.status);
    const buf=await r.arrayBuffer();
    const tif=await fromArrayBuffer(buf),image=await tif.getImage();
    const origin=image.getOrigin(),resolution=image.getResolution();
    const [x,y]=proj4(WGS84,HRAP,[lon,lat]);
    const px=Math.floor((x-origin[0])/resolution[0]);
    const py=Math.floor((y-origin[1])/resolution[1]);
    const width=image.getWidth(),height=image.getHeight();
    if(px<0||px>=width||py<0||py>=height)return res.status(200).json({ok:false,outsideRaster:true,date,lat,lon,source});

    // Sample a 3x3 neighborhood and keep the local maximum. This reduces
    // edge sensitivity while staying within roughly one HRAP-cell radius.
    const x0=clamp(px-1,0,width-1),y0=clamp(py-1,0,height-1),x1=clamp(px+2,1,width),y1=clamp(py+2,1,height);
    const rasters=await image.readRasters({window:[x0,y0,x1,y1],interleave:true});
    const vals=Array.from(rasters).map(Number).filter(v=>Number.isFinite(v)&&v>=0&&v<500);
    const inches=vals.length?Math.max(...vals):null;
    res.status(200).json({ok:inches!==null,date,lat,lon,inches,source,pixel:{x:px,y:py},sample:'3x3 local maximum',units:'inches'});
  }catch(error){
    res.status(502).json({ok:false,date,lat,lon,source,error:String(error?.message||error)});
  }
}