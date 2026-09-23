export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin','*');

  const q=String(req.query?.q||'').trim();
  if(!q) return res.status(400).json({error:'Missing search query'});

  const key=process.env.YOUTUBE_API_KEY;
  if(!key) return res.status(200).json({setupRequired:true,error:'YOUTUBE_API_KEY is not configured',items:[]});

  try{
    const params=new URLSearchParams({
      part:'snippet',
      q,
      type:'video',
      maxResults:'12',
      regionCode:'US',
      relevanceLanguage:'en',
      safeSearch:'moderate',
      videoEmbeddable:'true',
      videoSyndicated:'true',
      key
    });
    const r=await fetch('https://www.googleapis.com/youtube/v3/search?'+params.toString(),{headers:{'Accept':'application/json'}});
    const data=await r.json();
    if(!r.ok) throw new Error(data?.error?.message||('YouTube HTTP '+r.status));

    const items=(data.items||[]).map(x=>({
      id:x.id?.videoId||'',
      title:x.snippet?.title||'Untitled video',
      channel:x.snippet?.channelTitle||'YouTube',
      publishedAt:x.snippet?.publishedAt||null,
      thumbnail:x.snippet?.thumbnails?.medium?.url||x.snippet?.thumbnails?.default?.url||''
    })).filter(x=>x.id);

    return res.status(200).json({query:q,count:items.length,items});
  }catch(error){
    return res.status(500).json({error:error?.message||String(error),items:[]});
  }
}
