const URL = 'https://services.swpc.noaa.gov/products/glotec/geojson_2d_urt.json';

function pickNumeric(props = {}) {
  const preferred = ['tec','TEC','total_electron_content','totalElectronContent','anomaly','tec_anomaly','dtec','value','Value'];
  for (const key of preferred) {
    const n = Number(props[key]);
    if (Number.isFinite(n)) return { key, value:n };
  }
  for (const [key,val] of Object.entries(props)) {
    const n=Number(val);
    if (Number.isFinite(n) && !/^(lat|lon|lng|x|y|id|index)$/i.test(key)) return { key, value:n };
  }
  return { key:null, value:null };
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  try {
    const r=await fetch(URL,{headers:{'User-Agent':'Earth-Hazard-Tracker/1.17'},cache:'no-store'});
    if(!r.ok) throw new Error(`GloTEC HTTP ${r.status}`);
    const geo=await r.json();
    const input=Array.isArray(geo?.features)?geo.features:[];
    const maxFeatures=4500;
    const step=Math.max(1,Math.ceil(input.length/maxFeatures));
    let detectedField=null;
    const features=[];
    for(let i=0;i<input.length;i+=step){
      const f=input[i];
      if(!f?.geometry) continue;
      const picked=pickNumeric(f.properties||{});
      if(!detectedField&&picked.key) detectedField=picked.key;
      features.push({
        type:'Feature',
        geometry:f.geometry,
        properties:{...(f.properties||{}),eht_value:picked.value,eht_value_field:picked.key||''}
      });
    }
    res.status(200).json({
      type:'FeatureCollection',
      features,
      metadata:{source:URL,fetchedAt:new Date().toISOString(),originalFeatureCount:input.length,featureCount:features.length,detectedValueField:detectedField}
    });
  } catch(error) {
    console.error('glotec error',error);
    res.status(502).json({type:'FeatureCollection',features:[],metadata:{source:URL,error:String(error?.message||error)}});
  }
}
