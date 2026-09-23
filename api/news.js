const FEEDS = [
  { category:'weather', source:'Google News · Weather', url:'https://news.google.com/rss/search?q=weather%20OR%20hurricane%20OR%20flood%20OR%20wildfire%20OR%20earthquake%20OR%20volcano&hl=en-US&gl=US&ceid=US:en' },
  { category:'weather', source:'NOAA · Atlantic Tropical Weather', url:'https://www.nhc.noaa.gov/xml/TWDAT.xml' },
  { category:'weather', source:'NOAA · East Pacific Tropical Weather', url:'https://www.nhc.noaa.gov/xml/TWDEP.xml' },
  { category:'politics', source:'Google News · Politics', url:'https://news.google.com/rss/search?q=politics%20OR%20government%20OR%20election%20OR%20parliament%20OR%20congress&hl=en-US&gl=US&ceid=US:en' },
  { category:'world', source:'Google News · World', url:'https://news.google.com/rss/search?q=world%20news%20OR%20international&hl=en-US&gl=US&ceid=US:en' }
];

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Access-Control-Allow-Origin','*');
  try{
    const settled=await Promise.allSettled(FEEDS.map(fetchFeed));
    const articles=[]; const failures=[];
    settled.forEach((result,index)=>{
      if(result.status==='fulfilled') articles.push(...result.value);
      else failures.push({source:FEEDS[index].source,error:result.reason?.message||String(result.reason)});
    });
    const unique=dedupe(articles).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,120);
    return res.status(200).json({updatedAt:new Date().toISOString(),count:unique.length,failures,articles:unique});
  }catch(error){
    return res.status(500).json({error:'News aggregation failed',detail:error?.message||String(error)});
  }
}

async function fetchFeed(feed){
  const response=await fetch(feed.url,{headers:{'Accept':'application/rss+xml, application/xml, text/xml','User-Agent':'EarthHazardTracker/2.0'}});
  if(!response.ok) throw new Error('HTTP '+response.status);
  return parseItems(await response.text(),feed);
}

function parseItems(xml,feed){
  const blocks=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return blocks.slice(0,35).map((block,index)=>{
    const title=clean(readTag(block,'title'));
    const link=clean(readTag(block,'link'))||clean(readTag(block,'guid'));
    const pubDate=clean(readTag(block,'pubDate'))||clean(readTag(block,'dc:date'));
    const description=summarize(clean(readTag(block,'description')));
    const rssSource=clean(readTag(block,'source'));
    return {id:feed.category+'-'+index+'-'+simpleHash(title+link),category:feed.category,title:title||'Untitled update',description,source:rssSource||feed.source,publishedAt:validDate(pubDate),url:safeHttpUrl(link)};
  }).filter(item=>item.url&&item.title);
}

function readTag(block,tag){
  const match=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return match?match[1]:'';
}
function clean(value){return decodeEntities(String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());}
function decodeEntities(value){return value.replace(/&amp;/g,'&').replace(/&quot;/g,'\"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function summarize(text){if(!text)return'';const t=text.replace(/\s+/g,' ').trim();return t.length>260?t.slice(0,257)+'…':t;}
function validDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString();}
function safeHttpUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return'';}}
function dedupe(items){const seen=new Set();return items.filter(item=>{const k=item.url||item.title.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});}
function simpleHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}