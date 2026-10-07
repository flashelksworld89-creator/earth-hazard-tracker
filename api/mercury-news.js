const FEEDS=[
  {name:'World',q:'world OR international'},
  {name:'Politics',q:'politics OR government OR election OR congress OR parliament'},
  {name:'Economy',q:'economy OR markets OR business OR trade OR inflation'},
  {name:'Technology',q:'technology OR AI OR cyber OR internet OR software'},
  {name:'Conflict',q:'war OR military OR attack OR ceasefire'},
  {name:'Science',q:'science OR space OR research OR discovery'},
  {name:'Health',q:'health OR medicine OR disease OR hospital'},
  {name:'Climate',q:'climate OR weather OR wildfire OR flood OR earthquake OR hurricane'}
];

const CATEGORIES={
  'War / Conflict':['war','attack','strike','missile','military','troops','bomb','invasion','ceasefire','combat','shooting'],
  'Politics / Government':['election','president','government','congress','parliament','minister','court','law','policy','campaign'],
  'Economy / Markets':['economy','market','stocks','trade','tariff','inflation','jobs','bank','interest rate','currency','business'],
  'Technology / AI':['technology','artificial intelligence',' ai ','chip','cyber','software','internet','robot','data center'],
  'Science / Space':['science','space','nasa','research','satellite','astronomy','discovery','moon','mars mission'],
  'Health':['health','virus','disease','hospital','vaccine','outbreak','medical','drug'],
  'Climate / Disaster':['climate','weather','hurricane','typhoon','flood','wildfire','earthquake','volcano','storm','tornado'],
  'Crime / Public Safety':['police','crime','arrest','killed','shooting','security','terror','explosion'],
  'Culture / Entertainment':['film','music','celebrity','sports','festival','award','entertainment']
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin','*');
  try{
    const from=cleanDate(req.query?.from),to=cleanDate(req.query?.to);
    if(!from||!to) return res.status(400).json({error:'from and to dates are required'});
    const now=new Date();
    if(new Date(from+'T00:00:00Z')>now) return res.status(200).json({from,to,future:true,count:0,articles:[],categories:[]});

    const feeds=FEEDS.map(f=>({
      ...f,
      url:'https://news.google.com/rss/search?q='+encodeURIComponent(f.q+' after:'+from+' before:'+to)+'&hl=en-US&gl=US&ceid=US:en'
    }));
    const settled=await Promise.allSettled(feeds.map(fetchFeed));
    const items=[];
    for(const r of settled) if(r.status==='fulfilled') items.push(...r.value);
    const articles=dedupe(items)
      .filter(a=>a.publishedAt>=from && a.publishedAt<to)
      .sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt))
      .slice(0,80)
      .map(a=>({...a,newsCategory:classify(a.title+' '+a.description)}));
    const counts=new Map();
    for(const a of articles) counts.set(a.newsCategory,(counts.get(a.newsCategory)||0)+1);
    const categories=[...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
    return res.status(200).json({from,to,future:false,count:articles.length,categories,articles});
  }catch(e){
    return res.status(500).json({error:'Mercury news aggregation failed',detail:e?.message||String(e)});
  }
}

async function fetchFeed(feed){
  const r=await fetch(feed.url,{headers:{'Accept':'application/rss+xml, application/xml, text/xml','User-Agent':'MercuryTransitNewsTracker/1.0'}});
  if(!r.ok) throw new Error(feed.name+' HTTP '+r.status);
  const xml=await r.text();
  const blocks=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return blocks.slice(0,40).map((b,i)=>{
    const title=clean(readTag(b,'title'));
    const link=clean(readTag(b,'link'))||clean(readTag(b,'guid'));
    const pub=clean(readTag(b,'pubDate'))||clean(readTag(b,'dc:date'));
    const description=summary(clean(readTag(b,'description')));
    const source=clean(readTag(b,'source'))||feed.name;
    const d=new Date(pub);
    return {id:feed.name+'-'+i+'-'+hash(title+link),title,description,source,url:safe(link),publishedAt:Number.isFinite(d.getTime())?d.toISOString().slice(0,10):''};
  }).filter(x=>x.title&&x.url&&x.publishedAt);
}
function classify(text){
  const t=' '+String(text||'').toLowerCase()+' ';
  let best='General',score=0;
  for(const [name,terms] of Object.entries(CATEGORIES)){
    let n=0; for(const term of terms) if(t.includes(term)) n++;
    if(n>score){score=n;best=name}
  }
  return best;
}
function readTag(block,tag){const m=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));return m?m[1]:''}
function clean(v){return decode(String(v||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function decode(v){return v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function summary(v){return v.length>240?v.slice(0,237)+'…':v}
function safe(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
function cleanDate(v){const s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}
function dedupe(items){const seen=new Set();return items.filter(x=>{const k=(x.title||'').toLowerCase().replace(/\W+/g,' ').trim();if(seen.has(k))return false;seen.add(k);return true})}
function hash(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
