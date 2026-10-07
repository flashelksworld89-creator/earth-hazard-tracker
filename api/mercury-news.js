const FEEDS=[
  {name:'World',q:'world OR international OR diplomacy OR conflict'},
  {name:'Politics',q:'politics OR government OR election OR congress OR parliament OR court'},
  {name:'Economy',q:'economy OR markets OR business OR trade OR inflation OR jobs OR banking'},
  {name:'Technology',q:'technology OR AI OR cyber OR internet OR software OR telecommunications'},
  {name:'Science Health',q:'science OR space OR research OR health OR medicine OR disease'},
  {name:'Climate Energy',q:'climate OR weather OR disaster OR energy OR oil OR power grid'},
  {name:'Society',q:'immigration OR protest OR education OR housing OR human rights OR religion'},
  {name:'Culture',q:'sports OR entertainment OR celebrity OR media OR social media'}
];

const CATEGORIES={
  'War / Military Conflict':['war','military','troops','invasion','airstrike','air strike','missile','bombing','battle','combat','ceasefire','armed forces'],
  'Diplomacy / International Relations':['summit','diplomatic','diplomacy','treaty','negotiation','negotiations','sanctions','embassy','ambassador','alliance','bilateral','foreign minister'],
  'Elections / Political Campaigns':['election','elections','vote','voting','candidate','campaign','polling','primary election','ballot'],
  'Government / Policy / Legislation':['government','congress','parliament','senate','house bill','legislation','lawmakers','executive order','regulation','policy','cabinet','minister'],
  'Courts / Legal Decisions':['court','judge','lawsuit','trial','supreme court','indictment','verdict','appeal','prosecutor','legal ruling'],
  'Crime / Public Safety':['police','crime','arrest','shooting','homicide','murder','terror','explosion','security alert','manhunt'],
  'Economy / Growth / Recession':['economy','economic growth','gdp','recession','consumer spending','productivity','economic outlook'],
  'Markets / Investing':['stocks','stock market','shares','bonds','commodities','wall street','market rally','market selloff','investors'],
  'Banking / Interest Rates / Monetary Policy':['central bank','federal reserve','interest rate','rates decision','monetary policy','banking','liquidity','fed chair'],
  'Jobs / Labor / Unions':['jobs report','employment','unemployment','layoffs','labor','union','strike','wages','workers'],
  'Trade / Tariffs / Supply Chains':['trade','tariff','imports','exports','supply chain','shipping disruption','trade deal','customs'],
  'Corporate Business / Mergers':['merger','acquisition','bankruptcy','earnings','company results','corporate','takeover','ipo','chief executive'],
  'Technology / Software':['technology','software','computer','platform','app','semiconductor','chip','cloud computing','tech company'],
  'Artificial Intelligence / Robotics':['artificial intelligence',' ai ','machine learning','robot','robotics','chatbot','large language model','generative ai'],
  'Cybersecurity / Hacking / Data Breaches':['cyber','hack','hacking','ransomware','data breach','malware','cyberattack','security breach'],
  'Telecommunications / Internet':['internet','telecom','telecommunications','network outage','mobile network','broadband','social platform','communications network'],
  'Communication / Messaging / Information':['speech','announcement','statement','message','leak','leaked document','press conference','censorship','misinformation','disinformation','publishing'],
  'Documents / Contracts / Agreements':['contract','agreement','signed','memorandum','filing','court filing','regulatory filing','treaty document','settlement','paperwork'],
  'Science / Research / Discovery':['science','scientific','research','study finds','discovery','physics','biology','laboratory'],
  'Space / Astronomy':['space','nasa','spacecraft','satellite','rocket launch','astronomy','moon mission','mars mission','asteroid'],
  'Medicine / Health':['healthcare','hospital','medical','medicine','treatment','drug approval','surgery','doctor','patient'],
  'Disease / Outbreaks / Public Health':['virus','disease','outbreak','epidemic','pandemic','vaccine','public health','infection'],
  'Natural Disasters':['earthquake','volcano','tsunami','landslide','avalanche','natural disaster'],
  'Severe Weather':['hurricane','typhoon','tornado','flood','storm','blizzard','heatwave','heat wave','wildfire'],
  'Climate / Environment':['climate','environment','emissions','conservation','pollution','drought','warming','environmental'],
  'Energy / Oil / Gas':['oil','natural gas','opec','pipeline','energy prices','fuel','petroleum','gas prices'],
  'Nuclear / Power Infrastructure':['nuclear plant','reactor','power grid','electric grid','blackout','power outage','electricity infrastructure'],
  'Transportation / Aviation':['airline','aircraft','flight','airport','train','rail','shipping','ship','transportation','crash'],
  'Immigration / Borders / Refugees':['immigration','migrant','migration','border','asylum','refugee','deportation'],
  'Education':['school','university','college','student','education','teacher','campus'],
  'Housing / Real Estate':['housing','home prices','mortgage','rent','real estate','construction','property market'],
  'Agriculture / Food Supply':['agriculture','farm','crop','food supply','livestock','harvest','food shortage','grain'],
  'Media / Journalism / Information':['journalist','journalism','newspaper','news outlet','broadcast','media company','press freedom'],
  'Social Media / Online Culture':['social media','viral','influencer','online trend','tiktok','instagram','youtube','x platform'],
  'Entertainment / Celebrity':['film','movie','television','music','celebrity','actor','singer','award show','entertainment'],
  'Sports':['sports','championship','tournament','athlete','football','basketball','baseball','soccer','olympics'],
  'Religion / Faith Institutions':['religion','church','mosque','temple','pope','bishop','faith','religious'],
  'Protests / Civil Unrest':['protest','protests','demonstration','riot','civil unrest','march','mass movement'],
  'Human Rights / Social Issues':['human rights','civil rights','discrimination','humanitarian','equality','social justice'],
  'Deaths / Major Public Figures':['dies','died','death of','dead at','obituary','funeral','former president dies','celebrity dies'],
  'Accidents / Industrial Disasters':['industrial accident','factory explosion','chemical spill','building collapse','bridge collapse','accident','derailment'],
  'Consumer Products / Recalls':['recall','product recall','consumer product','safety warning','defect','product safety']
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
  let best='Other / Unclassified',score=0;
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
