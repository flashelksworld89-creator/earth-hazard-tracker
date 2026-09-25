const cache=new Map();

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Access-Control-Allow-Origin','*');
  const q=String(req.query?.q||'').replace(/[<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
  if(!q)return res.status(400).json({error:'Missing q'});
  const key=q.toLowerCase();
  if(cache.has(key))return res.status(200).json(cache.get(key));
  try{
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q='+encodeURIComponent(q);
    const r=await fetch(url,{headers:{'User-Agent':'EarthHazardTracker/2.0 aviation-pattern-agent','Accept':'application/json'}});
    if(!r.ok)throw new Error('Geocoder HTTP '+r.status);
    const rows=await r.json();
    const x=rows?.[0];
    if(!x){
      const out={found:false,query:q};cache.set(key,out);return res.status(200).json(out);
    }
    const out={
      found:true,query:q,lat:Number(x.lat),lon:Number(x.lon),
      displayName:x.display_name||q,
      country:x.address?.country||'',
      countryCode:(x.address?.country_code||'').toUpperCase(),
      state:x.address?.state||x.address?.region||'',
      city:x.address?.city||x.address?.town||x.address?.village||x.address?.municipality||''
    };
    cache.set(key,out);return res.status(200).json(out);
  }catch(error){
    return res.status(500).json({error:'Geocoding failed',detail:error?.message||String(error)});
  }
}