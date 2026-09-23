export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=180, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Origin','*');

  const result={
    updatedAt:new Date().toISOString(),
    fundamentalHz:7.83,
    source:'SunGeo / Tomsk-derived station monitoring',
    status:'Unavailable',
    score:null,
    observatories:null,
    tomskScore:null,
    sourceUpdatedAt:null,
    spectrogramUrl:'https://schumannresonancelive.com/en/live-spectrogram/',
    sourceUrl:'https://sungeo.net/schumann-resonance-today'
  };

  try{
    const r=await fetch(result.sourceUrl,{headers:{'User-Agent':'EarthHazardTracker/2.0','Accept':'text/html'}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const html=await r.text();

    const statusMatch=html.match(/Status\s*([A-Za-z]+)\s*(\d{1,3})\/100/i) ||
      html.match(/(Calm|Elevated|Active|Storm)\s*(\d{1,3})\/100/i);
    if(statusMatch){
      result.status=statusMatch[1];
      result.score=Number(statusMatch[2]);
    }

    const freqMatch=html.match(/Frequency\s*(\d+(?:\.\d+)?)\s*Hz/i);
    if(freqMatch) result.fundamentalHz=Number(freqMatch[1]);

    const obsMatch=html.match(/(\d+)\s*of\s*(\d+)\s*observatories\s*reporting/i);
    if(obsMatch) result.observatories={reporting:Number(obsMatch[1]),total:Number(obsMatch[2])};

    const tomskMatch=html.match(/Tomsk[\s\S]{0,180}?(Calm|Elevated|Active|Storm)?\s*(\d{1,3})/i);
    if(tomskMatch) result.tomskScore=Number(tomskMatch[2]);

    const updatedMatch=html.match(/Updated\s*(\d+)\s*(?:min|minute)s?\s*ago/i);
    if(updatedMatch){
      result.sourceUpdatedAt=new Date(Date.now()-Number(updatedMatch[1])*60000).toISOString();
    }

    return res.status(200).json(result);
  }catch(error){
    result.error=error?.message||String(error);
    return res.status(200).json(result);
  }
}
