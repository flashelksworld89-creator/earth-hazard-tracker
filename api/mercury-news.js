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

const MARS_THEMES={
  'War / Military Action':['war','military','troops','battle','combat','airstrike','air strike','missile','invasion','artillery','armed forces'],
  'Weapons / Defense':['weapon','weapons','arms','defense system','defence system','drone strike','munition','ammunition','fighter jet'],
  'Violence / Assault':['shooting','attack','assault','killed','murder','homicide','violence','stabbing','gunfire'],
  'Police / Security Operations':['police','swat','security forces','raid','arrest operation','law enforcement','manhunt','crackdown'],
  'Fires / Explosions':['fire','wildfire','explosion','blast','burning','detonation','factory fire'],
  'Accidents / Crashes':['crash','collision','accident','derailment','wreck','vehicle accident','industrial accident'],
  'Engineering / Mechanical Failure':['structural failure','bridge collapse','mechanical failure','engineering failure','equipment failure','infrastructure failure'],
  'Surgery / Emergency Medicine':['surgery','surgeon','trauma','emergency room','emergency surgery','injury','wounded'],
  'Protests / Confrontation':['protest','riot','clash','confrontation','demonstration','civil unrest','violent protest'],
  'Competition / Sports':['competition','championship','tournament','match','fight','boxing','mma','race','sports'],
  'Emergency Response':['emergency response','firefighters','rescue','evacuation','first responders','disaster response'],
  'Territorial / Border Conflict':['border clash','territorial dispute','border conflict','incursion','frontier','occupation']
};

const VENUS_THEMES={
  'Relationships / Marriage':['marriage','married','wedding','divorce','relationship','couple','engagement','spouse','romance','dating'],
  'Diplomacy / Reconciliation':['reconciliation','peace talks','peace agreement','diplomatic agreement','settlement','truce','mediation','normalize relations'],
  'Women / Gender Issues':['women','woman','female','gender equality','women rights','maternal','girl'],
  'Beauty / Fashion':['fashion','beauty','cosmetics','designer','runway','model','jewelry','perfume'],
  'Film / Music / Arts':['film','movie','music','album','concert','art','artist','museum','theater','theatre'],
  'Celebrity / Social Status':['celebrity','star','royal','socialite','famous','red carpet','award show'],
  'Luxury / Consumer Goods':['luxury','luxury brand','designer brand','watch','jewelry','premium','high-end','consumer spending'],
  'Hospitality / Tourism':['hotel','tourism','tourist','travel destination','resort','hospitality','vacation'],
  'Real Estate / Property':['real estate','property','home sale','housing market','luxury home','estate'],
  'Money / Wealth / Banking':['wealth','billionaire','banking','finance','assets','fortune','net worth','private equity'],
  'Mergers / Partnerships / Contracts':['merger','partnership','joint venture','deal','contract','acquisition','agreement'],
  'Sexuality / Reproductive Issues':['sexuality','reproductive','abortion','fertility','ivf','birth control','contraception'],
  'Social Harmony / Cultural Trends':['culture','social trend','lifestyle','social harmony','community','popular culture'],
  'Relationship / Money / Status Scandal':['affair','relationship scandal','divorce battle','financial scandal','luxury scandal','celebrity scandal']
};

const POSITIVE=['support','supported','approval','approved','praise','praised','success','successful','victory','win','wins','agreement','deal','peace','endorsement','endorsed'];
const NEGATIVE=['opposition','oppose','opposed','condemn','condemned','criticism','criticized','protest','scandal','investigation','indicted','indictment','resign','resignation','crisis','failure','failed','attack','conflict','controversy'];
const SUPPORT=['support','endorsed','endorsement','rally','backed','praise','praised','approval'];
const OPPOSITION=['opposition','oppose','opposed','condemn','condemned','criticism','criticized','calls to resign','resign','protest'];
const PROTEST=['protest','protests','demonstration','demonstrations','march','rally','civil unrest'];
const LEADER_PATTERNS=[
  /\bPresident\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bPrime Minister\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bPremier\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bChancellor\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bKing\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bQueen\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g,
  /\bGovernor\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/g
];

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin','*');
  try{
    const from=cleanDate(req.query?.from),to=cleanDate(req.query?.to);
    const planet=cleanPlanet(req.query?.planet);
    if(!from||!to) return res.status(400).json({error:'from and to dates are required'});
    const now=new Date();
    if(new Date(from+'T00:00:00Z')>now) return res.status(200).json({from,to,planet,future:true,count:0,articles:[],categories:[],subjects:[],leaderEvidence:[],sourceCounts:{},sourceCoverage:{googleNews:{available:true,label:'Google News RSS'},gdelt:{available:false,label:'GDELT DOC 2.0',reason:'Future window'}}});

    const feeds=FEEDS.map(f=>({
      ...f,
      url:'https://news.google.com/rss/search?q='+encodeURIComponent(f.q+' after:'+from+' before:'+to)+'&hl=en-US&gl=US&ceid=US:en'
    }));
    const settled=await Promise.allSettled(feeds.map(fetchFeed));
    const items=[];
    for(const r of settled) if(r.status==='fulfilled') items.push(...r.value);

    const gdeltCoverage=isWithinGdeltDocWindow(from,to);
    if(gdeltCoverage.available){
      const gdeltSettled=await Promise.allSettled(FEEDS.slice(0,6).map(f=>fetchGdeltFeed(f,from,to)));
      for(const r of gdeltSettled) if(r.status==='fulfilled') items.push(...r.value);
    }
    const articles=dedupe(items)
      .filter(a=>a.publishedAt>=from && a.publishedAt<to)
      .sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt))
      .slice(0,160)
      .map(a=>({...a,newsCategory:classify(a.title+' '+a.description)}));
    const counts=new Map();
    for(const a of articles) counts.set(a.newsCategory,(counts.get(a.newsCategory)||0)+1);
    const categories=[...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
    const leaderEvidence=planet==='Sun'?buildLeaderEvidence(articles):[];
    const subjects=buildOrganicSubjects(articles);
    const sourceCounts=countSources(articles);
    return res.status(200).json({
      from,to,planet,future:false,count:articles.length,categories,subjects,articles,leaderEvidence,
      sourceCounts,
      sourceCoverage:{
        googleNews:{available:true,label:'Google News RSS'},
        gdelt:{available:gdeltCoverage.available,label:'GDELT DOC 2.0',reason:gdeltCoverage.reason||''}
      }
    });
  }catch(e){
    return res.status(500).json({error:'Transit news aggregation failed',detail:e?.message||String(e)});
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
    return {id:feed.name+'-'+i+'-'+hash(title+link),title,description,source,url:safe(link),archiveSource:'Google News',publishedAt:Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'',publishedAtFull:Number.isFinite(d.getTime())?d.toISOString():''};
  }).filter(x=>x.title&&x.url&&x.publishedAt);
}
async function fetchGdeltFeed(feed,from,to){
  const start=from.replace(/-/g,'')+'000000';
  const end=to.replace(/-/g,'')+'235959';
  const url='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent('('+feed.q+')')+
    '&mode=ArtList&format=json&maxrecords=75&sort=DateDesc&startdatetime='+start+'&enddatetime='+end;
  const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'PlanetTransitNewsTracker/1.0'}});
  if(!r.ok)throw new Error('GDELT '+feed.name+' HTTP '+r.status);
  const json=await r.json();
  const rows=Array.isArray(json?.articles)?json.articles:[];
  return rows.map((x,i)=>{
    const d=parseGdeltDate(x.seendate||x.date||'');
    return{
      id:'gdelt-'+feed.name+'-'+i+'-'+hash(String(x.title||'')+String(x.url||'')),
      title:clean(x.title||''),
      description:'',
      source:clean(x.domain||x.sourcecountry||'GDELT'),
      url:safe(x.url||''),
      archiveSource:'GDELT',
      publishedAt:Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'',
      publishedAtFull:Number.isFinite(d.getTime())?d.toISOString():''
    };
  }).filter(x=>x.title&&x.url&&x.publishedAt);
}
function parseGdeltDate(v){
  const s=String(v||'');
  const m=s.match(/^(\d{4})(\d{2})(\d{2})(?:T)?(\d{2})(\d{2})(\d{2})/);
  if(m)return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]));
  return new Date(s);
}
function isWithinGdeltDocWindow(from,to){
  const now=Date.now();
  const start=new Date(from+'T00:00:00Z').getTime();
  const end=new Date(to+'T23:59:59Z').getTime();
  const cutoff=now-366*86400000;
  if(end<cutoff)return{available:false,reason:'GDELT DOC 2.0 searchable window does not extend this far back'};
  if(start>now)return{available:false,reason:'Future window'};
  return{available:true,reason:''};
}
const SUBJECT_STOP=new Set(('the a an and or but if then than to of in on for from with without at by as is are was were be been being this that these those it its their his her they them he she you we our your about after before during over under into out up down new latest says said say report reports reported amid as us u.s. will would could should may might can just more most less least first last today yesterday tomorrow year years day days week weeks month months').split(/\s+/));
function buildOrganicSubjects(articles){
  const unigram=new Map(),bigram=new Map();
  for(const a of articles){
    const tokens=String(a.title||'').toLowerCase()
      .replace(/https?:\/\/\S+/g,' ')
      .replace(/[^a-z0-9' -]+/g,' ')
      .split(/\s+/)
      .map(x=>x.replace(/^'+|'+$/g,''))
      .filter(x=>x.length>=3&&!SUBJECT_STOP.has(x)&&!/^[0-9]+$/.test(x));
    const unique=new Set(tokens);
    for(const t of unique)unigram.set(t,(unigram.get(t)||0)+1);
    const seenBi=new Set();
    for(let i=0;i<tokens.length-1;i++){
      const phrase=tokens[i]+' '+tokens[i+1];
      if(!seenBi.has(phrase)){bigram.set(phrase,(bigram.get(phrase)||0)+1);seenBi.add(phrase)}
    }
  }
  const phrases=[...bigram.entries()].filter(([,c])=>c>=2).map(([name,count])=>({name,count,type:'phrase'}));
  const words=[...unigram.entries()].filter(([,c])=>c>=2).map(([name,count])=>({name,count,type:'word'}));
  const merged=[...phrases,...words].sort((a,b)=>b.count-a.count||b.name.length-a.name.length);
  const selected=[];
  for(const x of merged){
    if(selected.some(y=>y.name.includes(x.name)||x.name.includes(y.name)))continue;
    selected.push(x);
    if(selected.length>=15)break;
  }
  return selected;
}
function countSources(articles){
  const m={};
  for(const a of articles){const k=a.archiveSource||'Unknown';m[k]=(m[k]||0)+1}
  return m;
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

function buildMarsEvidence(articles){
  const counts=new Map();
  for(const article of articles){
    const t=' '+(article.title+' '+article.description).toLowerCase()+' ';
    for(const [name,terms] of Object.entries(MARS_THEMES)){
      let score=0;
      for(const term of terms)if(t.includes(term))score++;
      if(score>0)counts.set(name,(counts.get(name)||0)+1);
    }
  }
  return [...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
}

function buildVenusEvidence(articles){
  const counts=new Map();
  for(const article of articles){
    const t=' '+(article.title+' '+article.description).toLowerCase()+' ';
    for(const [name,terms] of Object.entries(VENUS_THEMES)){
      let score=0;
      for(const term of terms)if(t.includes(term))score++;
      if(score>0)counts.set(name,(counts.get(name)||0)+1);
    }
  }
  return [...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
}

function buildLeaderEvidence(articles){
  const byLeader=new Map();
  for(const article of articles){
    const text=(article.title+' '+article.description).trim();
    const names=extractLeaders(text);
    if(!names.length) continue;
    const sentiment=sentimentClass(text);
    const low=' '+text.toLowerCase()+' ';
    for(const name of names){
      if(!byLeader.has(name)) byLeader.set(name,{name,mentions:0,positive:0,negative:0,neutral:0,supportSignals:0,oppositionSignals:0,protestSignals:0,categories:new Map()});
      const x=byLeader.get(name);
      x.mentions++;
      x[sentiment]++;
      if(hasAny(low,SUPPORT))x.supportSignals++;
      if(hasAny(low,OPPOSITION))x.oppositionSignals++;
      if(hasAny(low,PROTEST))x.protestSignals++;
      x.categories.set(article.newsCategory,(x.categories.get(article.newsCategory)||0)+1);
    }
  }
  return [...byLeader.values()]
    .filter(x=>x.mentions>=2)
    .sort((a,b)=>b.mentions-a.mentions||a.name.localeCompare(b.name))
    .slice(0,30)
    .map(x=>({
      name:x.name,mentions:x.mentions,positive:x.positive,negative:x.negative,neutral:x.neutral,
      supportSignals:x.supportSignals,oppositionSignals:x.oppositionSignals,protestSignals:x.protestSignals,
      topIssues:[...x.categories.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name,count])=>({name,count}))
    }));
}
function extractLeaders(text){
  const out=new Set();
  for(const re of LEADER_PATTERNS){
    re.lastIndex=0;
    let m;
    while((m=re.exec(text))){
      const name=String(m[1]||'').replace(/\s+/g,' ').trim().replace(/[,:;.!?]+$/,'');
      if(name.length>=3)out.add(name);
    }
  }
  return [...out];
}
function sentimentClass(text){
  const t=' '+String(text||'').toLowerCase()+' ';
  let pos=0,neg=0;
  for(const k of POSITIVE)if(t.includes(k))pos++;
  for(const k of NEGATIVE)if(t.includes(k))neg++;
  if(pos>neg)return'positive';
  if(neg>pos)return'negative';
  return'neutral';
}
function hasAny(text,terms){return terms.some(k=>text.includes(k))}
function cleanPlanet(v){
  const p=String(v||'Mercury').toLowerCase();
  if(p==='sun')return'Sun';
  if(p==='venus')return'Venus';
  if(p==='mars')return'Mars';
  return'Mercury';
}
