const CURRENT='https://water.noaa.gov/resources/downloads/precip/stageIV/current/nws_precip_last24hours_conus.tif';
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=1200');
  try{const r=await fetch(CURRENT,{method:'HEAD',cache:'no-store'});res.status(200).json({ok:r.ok,url:CURRENT,status:r.status,contentLength:r.headers.get('content-length'),lastModified:r.headers.get('last-modified'),description:'NOAA Stage IV latest 24-hour CONUS QPE GeoTIFF'})}
  catch(error){res.status(502).json({ok:false,url:CURRENT,error:String(error?.message||error)})}
}