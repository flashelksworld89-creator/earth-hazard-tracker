import fs from 'node:fs/promises';
import path from 'node:path';

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

const SUBCATEGORIES={
  'Science / Research / Discovery':{
    'Genetics / Genomics':['genetics','genome','genomic','dna','gene editing','crispr','hereditary'],
    'Neuroscience / Brain Research':['neuroscience','brain','neuron','cognitive','memory','alzheimers','dementia'],
    'Physics / Quantum Research':['physics','quantum','particle','cern','boson','neutrino'],
    'Chemistry / Molecular Science':['chemistry','molecule','molecular','catalyst'],
    'Biology / Evolution':['biology','evolution','species','cell biology','microbiology','ecology'],
    'Archaeology / Anthropology':['archaeology','archaeological','ancient remains','fossil','anthropology','excavation'],
    'Materials Science':['materials science','superconductor','alloy','polymer','nanomaterial','graphene'],
    'Earth / Geological Science':['geology','geological','tectonic','seismology','geoscience','mineral'],
    'Ocean / Marine Science':['oceanography','marine biology','deep sea','coral','ocean science'],
    'Climate Science':['climate study','climate research','atmospheric science','climate model'],
    'Medical / Biomedical Research':['biomedical','clinical trial','medical research','disease research','drug discovery']
  },
  'Technology / Software':{
    'Consumer Technology':['smartphone','laptop','device','consumer electronics','wearable'],
    'Software / Platforms':['software','platform','operating system','app','developer','cloud service'],
    'Semiconductors / Chips':['chip','semiconductor','processor','gpu','foundry'],
    'Computing Infrastructure':['data center','server','cloud computing','supercomputer'],
    'Robotics / Automation':['robot','robotics','automation','autonomous system'],
    'Open Source / Developer Tools':['open source','github','programming language','developer tools']
  },
  'Artificial Intelligence / Robotics':{
    'Generative AI':['generative ai','large language model','llm','chatbot','text generation','image generation'],
    'AI Models / Research':['ai model','machine learning model','deep learning','neural network'],
    'AI Regulation / Governance':['ai regulation','ai law','ai safety','ai governance'],
    'AI Business / Investment':['ai company','ai startup','ai investment','ai funding'],
    'Robotics / Autonomous Systems':['robotics','robot','autonomous vehicle','autonomous system']
  },
  'Medicine / Health':{
    'Cancer / Oncology':['cancer','tumor','oncology','chemotherapy'],
    'Cardiovascular Health':['heart disease','cardiac','cardiovascular','stroke'],
    'Neurology / Mental Health':['mental health','depression','anxiety','neurological','psychiatric'],
    'Surgery / Trauma Care':['surgery','surgeon','trauma','operation'],
    'Pharmaceuticals / Drug Development':['drug approval','pharmaceutical','medication','therapy','clinical trial'],
    'Maternal / Reproductive Health':['pregnancy','maternal','fertility','ivf','reproductive health']
  },
  'Disease / Outbreaks / Public Health':{
    'Pandemics / Epidemics':['pandemic','epidemic','global outbreak','public health emergency of international concern','pheic'],
    'Disease Spread / Transmission':['transmission','community spread','person-to-person','human-to-human','spread of','infection rate','transmissibility','r0','reproduction number'],
    'Outbreak Detection / Emergence':['outbreak detected','new outbreak','emerging disease','new strain','new variant','cluster of cases','first case','index case'],
    'Respiratory Disease':['flu','influenza','covid','coronavirus','respiratory virus','rsv'],
    'Vector-Borne Disease':['malaria','dengue','mosquito','zika','chikungunya','west nile'],
    'Food / Waterborne Disease':['foodborne','salmonella','e coli','cholera','listeria','norovirus'],
    'Vaccination / Immunization':['vaccine','vaccination','immunization','booster dose','vaccine rollout'],
    'Cures / Breakthrough Treatments':['cure','breakthrough treatment','effective treatment','new therapy','treatment breakthrough','remission','curative'],
    'Antivirals / Antibiotics':['antiviral','antibiotic','antimicrobial','antiretroviral','new drug treatment'],
    'Drug Resistance':['drug resistance','antibiotic resistance','antimicrobial resistance','resistant strain','multidrug resistant'],
    'Mortality / Case Growth':['death toll','mortality rate','case count','cases rise','cases surge','infection surge','fatality rate','hospitalizations rise'],
    'Containment / Quarantine Measures':['quarantine','lockdown','containment measure','isolation order','travel restriction'],
    'Public Health Policy':['public health policy','health emergency','health department','public health agency','cdc guidance','who guidance']
  },
  'Economy / Growth / Recession':{
    'GDP / Economic Growth':['gdp','economic growth','growth forecast'],
    'Inflation / Cost of Living':['inflation','cost of living','consumer prices'],
    'Recession / Slowdown':['recession','slowdown','contraction'],
    'Consumer Spending':['consumer spending','retail sales','household spending'],
    'Productivity / Output':['productivity','industrial output','manufacturing output']
  },
  'Markets / Investing':{
    'Equities / Stock Markets':['stocks','stock market','shares','equities'],
    'Bonds / Fixed Income':['bonds','treasury yields','fixed income'],
    'Commodities':['commodities','gold prices','silver prices','copper prices'],
    'Cryptocurrency / Digital Assets':['bitcoin','crypto','cryptocurrency','ethereum','digital assets'],
    'Investor Sentiment':['investor sentiment','market rally','market selloff','risk appetite']
  },
  'Government / Policy / Legislation':{
    'Executive Action':['executive order','presidential action','decree'],
    'Legislation / Bills':['bill','legislation','lawmakers','senate vote','house vote'],
    'Regulation':['regulation','regulatory rule','agency rule'],
    'Budget / Spending':['budget','government spending','appropriations'],
    'Administrative Policy':['policy change','agency policy','cabinet decision']
  },
  'Courts / Legal Decisions':{
    'Supreme / Constitutional Courts':['supreme court','constitutional court'],
    'Criminal Trials':['criminal trial','indictment','prosecutor','jury'],
    'Civil Litigation':['lawsuit','civil case','damages','settlement'],
    'Appeals / Rulings':['appeal','ruling','verdict','judgment']
  },
  'War / Military Conflict':{
    'Ground Combat':['ground offensive','troops','battle','combat','front line'],
    'Air / Missile Strikes':['airstrike','air strike','missile strike','bombing'],
    'Naval Conflict':['naval','warship','navy','maritime attack'],
    'Ceasefire / Negotiations':['ceasefire','truce','peace talks'],
    'Weapons / Defense Systems':['weapons','air defense','drone','missile system']
  },
  'Crime / Public Safety':{
    'Homicide / Violent Crime':['murder','homicide','shooting','stabbing'],
    'Organized Crime':['organized crime','gang','cartel','mafia'],
    'Terrorism / Extremist Violence':['terror','terrorism','extremist attack'],
    'Police / Law Enforcement':['police','law enforcement','manhunt','raid'],
    'Fraud / Financial Crime':['fraud','embezzlement','money laundering','scam']
  },
  'Severe Weather':{
    'Hurricanes / Tropical Cyclones':['hurricane','typhoon','cyclone'],
    'Tornadoes / Severe Storms':['tornado','severe storm','supercell'],
    'Flooding':['flood','flash flood'],
    'Wildfire':['wildfire','brush fire'],
    'Heat / Cold Extremes':['heatwave','heat wave','cold snap','extreme cold'],
    'Winter Storms':['blizzard','snowstorm','winter storm']
  },
  'Natural Disasters':{
    'Earthquakes':['earthquake','aftershock','seismic'],
    'Volcanoes':['volcano','volcanic eruption'],
    'Tsunamis':['tsunami'],
    'Landslides':['landslide','mudslide'],
    'Avalanches':['avalanche']
  },
  'Climate / Environment':{
    'Emissions / Carbon':['emissions','carbon dioxide','greenhouse gas'],
    'Pollution':['pollution','air quality','contamination'],
    'Conservation / Wildlife':['conservation','wildlife','endangered species','habitat'],
    'Drought / Water Scarcity':['drought','water scarcity','reservoir'],
    'Climate Policy':['climate policy','climate agreement','net zero']
  },
  'Energy / Oil / Gas':{
    'Oil Markets':['oil prices','crude oil','opec'],
    'Natural Gas':['natural gas','lng','gas supply'],
    'Renewable Energy':['solar power','wind power','renewable energy'],
    'Energy Infrastructure':['pipeline','refinery','energy grid'],
    'Fuel Prices':['gas prices','fuel prices']
  },
  'Transportation / Aviation':{
    'Commercial Aviation':['airline','airport','flight','passenger aircraft'],
    'Aviation Accidents':['plane crash','aircraft crash','aviation accident'],
    'Rail / Trains':['train','rail','railway','derailment'],
    'Shipping / Maritime':['shipping','cargo ship','port','maritime'],
    'Road / Automotive':['vehicle','car crash','highway','automotive']
  },
  'Social Media / Online Culture':{
    'Viral Trends / Memes':['viral','meme','online trend','viral challenge'],
    'Influencers / Creators':['influencer','creator','streamer','content creator'],
    'Platform Controversies':['tiktok','instagram','youtube','x platform','facebook','platform ban','account suspension'],
    'Online Movements / Campaigns':['hashtag campaign','online campaign','digital movement','boycott'],
    'Fandom / Internet Communities':['fandom','online community','fan community']
  },
  'Space / Astronomy':{
    'Launches / Rockets':['rocket launch','launch vehicle','space launch'],
    'Moon Missions':['moon mission','lunar mission'],
    'Mars / Planetary Missions':['mars mission','planetary mission'],
    'Satellites':['satellite','earth observation satellite'],
    'Astronomy / Telescopes':['astronomy','telescope','exoplanet','galaxy']
  },
  'Sports':{
    'Football / Soccer':['football','soccer','fifa'],
    'Basketball':['basketball','nba','wnba'],
    'Baseball':['baseball','mlb'],
    'Combat Sports':['boxing','mma','ufc'],
    'Motorsport':['formula 1','nascar','motorsport'],
    'Olympics / International Competition':['olympics','olympic','world championship']
  },
  'Diplomacy / International Relations':{
    'Peace Talks / Ceasefires':['peace talks','ceasefire','truce','peace agreement'],
    'Summits / State Visits':['summit','state visit','bilateral meeting','leaders meeting'],
    'Sanctions / Diplomatic Pressure':['sanctions','diplomatic pressure','expulsion','embassy closure'],
    'Treaties / Alliances':['treaty','alliance','security pact','bilateral agreement']
  },
  'Elections / Political Campaigns':{
    'National Elections':['presidential election','general election','national election'],
    'Primaries / Party Contests':['primary election','party primary','leadership contest'],
    'Polling / Voter Opinion':['polling','opinion poll','approval poll','voter survey'],
    'Campaign Events / Debates':['campaign rally','debate','campaign event','candidate forum']
  },
  'Banking / Interest Rates / Monetary Policy':{
    'Central Bank Decisions':['central bank','federal reserve','rate decision','monetary policy meeting'],
    'Interest Rate Changes':['rate hike','rate cut','interest rates'],
    'Banking Stability':['bank failure','bank crisis','liquidity crisis','deposit outflow'],
    'Credit / Lending Conditions':['credit conditions','lending standards','loan demand']
  },
  'Jobs / Labor / Unions':{
    'Employment / Unemployment':['employment','unemployment','jobs report'],
    'Layoffs / Hiring':['layoffs','job cuts','hiring','recruitment'],
    'Wages / Pay':['wages','pay growth','salary'],
    'Strikes / Labor Action':['strike','walkout','labor action','union protest']
  },
  'Trade / Tariffs / Supply Chains':{
    'Tariffs / Trade Barriers':['tariff','trade barrier','duties'],
    'Trade Agreements':['trade deal','trade agreement','free trade agreement'],
    'Imports / Exports':['imports','exports','export controls'],
    'Supply Chain / Logistics':['supply chain','logistics','shipping disruption','port disruption']
  },
  'Corporate Business / Mergers':{
    'Mergers / Acquisitions':['merger','acquisition','takeover'],
    'Earnings / Revenue':['earnings','revenue','quarterly results','profit'],
    'Bankruptcy / Restructuring':['bankruptcy','restructuring','insolvency'],
    'IPO / Fundraising':['ipo','initial public offering','fundraising','venture funding']
  },
  'Cybersecurity / Hacking / Data Breaches':{
    'Ransomware':['ransomware'],
    'Data Breaches':['data breach','leaked data','stolen data'],
    'Cyber Espionage':['cyber espionage','state-sponsored hacking','nation-state hacking'],
    'Malware / Vulnerabilities':['malware','zero-day','vulnerability','exploit']
  },
  'Telecommunications / Internet':{
    'Mobile / 5G Networks':['5g','mobile network','wireless carrier'],
    'Broadband / Fiber':['broadband','fiber internet','fiber network'],
    'Internet / Network Outages':['internet outage','network outage','service outage'],
    'Satellite Internet':['satellite internet','starlink']
  },
  'Communication / Messaging / Information':{
    'Public Statements / Speeches':['speech','statement','press conference','address'],
    'Leaks / Disclosures':['leak','leaked document','whistleblower'],
    'Misinformation / Disinformation':['misinformation','disinformation','false claims'],
    'Censorship / Information Control':['censorship','information control','content restriction']
  },
  'Documents / Contracts / Agreements':{
    'Contracts / Commercial Agreements':['contract','commercial agreement','signed agreement'],
    'Legal Filings':['court filing','legal filing','motion filed'],
    'Settlements':['settlement','settlement agreement'],
    'Treaties / Memoranda':['memorandum','mou','treaty document']
  },
  'Nuclear / Power Infrastructure':{
    'Nuclear Plants / Reactors':['nuclear plant','reactor','nuclear facility'],
    'Power Grid / Blackouts':['power grid','blackout','grid failure'],
    'Electricity Infrastructure':['substation','transmission line','electricity infrastructure'],
    'Nuclear Safety / Incidents':['radiation','nuclear incident','reactor shutdown']
  },
  'Immigration / Borders / Refugees':{
    'Border Enforcement':['border patrol','border security','border enforcement'],
    'Asylum / Refugees':['asylum','refugee','refugees'],
    'Deportation / Removal':['deportation','deported','removal order'],
    'Migration Flows':['migration','migrant arrivals','migrant crossings']
  },
  'Education':{
    'K-12 Schools':['elementary school','high school','school district','teacher'],
    'Higher Education':['university','college','campus'],
    'Student Policy / Protests':['student protest','campus protest','student policy'],
    'Curriculum / Standards':['curriculum','academic standards','education standards']
  },
  'Housing / Real Estate':{
    'Home Prices / Sales':['home prices','home sales','housing market'],
    'Rent / Tenants':['rent','rental market','tenant'],
    'Mortgages':['mortgage','mortgage rates'],
    'Commercial Real Estate':['commercial real estate','office property','retail property']
  },
  'Agriculture / Food Supply':{
    'Crops / Harvests':['crop','harvest','grain','wheat','corn','soybean','rice','barley','crop yield'],
    'Livestock / Animal Agriculture':['livestock','cattle','poultry','swine','pig','hog','dairy herd','beef herd'],
    'Food Prices / Inflation':['food prices','food inflation','grocery prices','food costs','staple prices'],
    'Food Shortages / Food Insecurity':['food shortage','food supply shortage','food insecurity','famine','hunger crisis','malnutrition crisis'],
    'Food Safety / Contamination':['food safety','food contamination','contaminated food','food poisoning','salmonella','listeria','e coli contamination'],
    'Food Recalls':['food recall','produce recall','meat recall','dairy recall','recall food'],
    'Crop Disease / Plant Pathogens':['crop disease','plant disease','crop fungus','plant pathogen','wheat rust','blight','crop virus'],
    'Agricultural Pests / Locusts':['pest outbreak','crop pest','locust','locust swarm','invasive pest','insect infestation'],
    'Livestock Disease':['livestock disease','cattle disease','swine fever','avian flu','bird flu','foot and mouth disease','animal disease outbreak'],
    'Agricultural Weather Impacts':['crop drought','farm drought','flooded farms','frost damage','heat damage crops','weather crop damage'],
    'Major Commodity Shortages':['grain shortage','wheat shortage','rice shortage','corn shortage','sugar shortage','coffee shortage','cocoa shortage'],
    'Fertilizer / Farm Inputs':['fertilizer','fertiliser','seed shortage','farm input costs','pesticide','irrigation'],
    'Farm Policy / Subsidies':['farm bill','agriculture policy','farm subsidy','agricultural subsidy','crop insurance']
  },
  'Media / Journalism / Information':{
    'News Organizations':['newspaper','news outlet','media company'],
    'Journalists / Press Freedom':['journalist','reporter','press freedom'],
    'Broadcast / Television':['broadcast network','television network','tv news'],
    'Digital Publishing':['digital news','publisher','news website']
  },
  'Entertainment / Celebrity':{
    'Film / Television':['film','movie','television','tv series','box office'],
    'Music':['music','album','concert','singer','rapper'],
    'Celebrity News':['celebrity','actor','actress','star'],
    'Awards / Festivals':['award show','oscars','grammys','festival']
  },
  'Religion / Faith Institutions':{
    'Christianity / Churches':['church','pope','bishop','christian'],
    'Islam / Mosques':['mosque','imam','islamic'],
    'Judaism / Synagogues':['synagogue','rabbi','jewish'],
    'Religious Freedom / Policy':['religious freedom','faith policy','religious law']
  },
  'Protests / Civil Unrest':{
    'Political Protests':['political protest','anti-government protest'],
    'Labor Protests / Strikes':['labor protest','workers protest','strike'],
    'Student Protests':['student protest','campus protest'],
    'Riots / Violent Unrest':['riot','violent protest','civil unrest']
  },
  'Human Rights / Social Issues':{
    'Civil Rights':['civil rights','discrimination'],
    'Gender / Equality':['gender equality','women rights','lgbtq'],
    'Humanitarian Crisis':['humanitarian crisis','aid crisis','displacement'],
    'Speech / Civil Liberties':['free speech','freedom of expression','civil liberties']
  },
  'Deaths / Major Public Figures':{
    'Political Leaders':['president dies','prime minister dies','former president dies'],
    'Entertainment Figures':['actor dies','singer dies','celebrity dies'],
    'Business / Cultural Figures':['ceo dies','founder dies','artist dies'],
    'Obituaries / Memorials':['obituary','memorial','funeral']
  },
  'Accidents / Industrial Disasters':{
    'Factory / Industrial Accidents':['industrial accident','factory explosion','plant accident'],
    'Chemical / Hazardous Spills':['chemical spill','toxic leak','hazardous spill'],
    'Building / Bridge Collapse':['building collapse','bridge collapse','structural collapse'],
    'Rail / Transport Accidents':['derailment','transport accident','train crash']
  },
  'Consumer Products / Recalls':{
    'Product Recalls':['product recall','recall notice'],
    'Safety Defects':['safety defect','defect','safety warning'],
    'Food / Drug Recalls':['food recall','drug recall','medicine recall'],
    'Vehicle Recalls':['vehicle recall','car recall','automotive recall']
  }
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
    if(new Date(from+'T00:00:00Z')>now) return res.status(200).json({from,to,planet,future:true,count:0,rawCount:0,publisherCount:0,archiveQuality:{level:'future',analysisEligible:false,reason:'Future window'},eventCount:0,eventClusters:[],articles:[],categories:[],subcategories:[],subjects:[],leaderEvidence:[],sourceCounts:{},sourceCoverage:{googleNews:{available:true,label:'Google News RSS'},gdelt:{available:false,label:'GDELT DOC 2.0',reason:'Future window'}}});
    if(to<'2014-01-01'){
      const historical=await buildHistoricalEventResponse(from,to,planet);
      return res.status(200).json(historical);
    }

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

    // Do not let a sparse or empty GDELT response collapse the report. When the
    // combined archive is thin, add major dated events from Wikipedia's
    // Current Events archive as an independent fallback source.
    let preliminary=dedupe(items).filter(a=>a.publishedAt>=from && a.publishedAt<to);
    let wikipediaFallbackUsed=false;
    if(preliminary.length<12){
      const fallback=await fetchWikipediaCurrentEvents(from,to);
      if(fallback.length){
        items.push(...fallback);
        wikipediaFallbackUsed=true;
      }
    }
    const rawArticles=dedupe(items)
      .filter(a=>a.publishedAt>=from && a.publishedAt<to);
    const balancedArticles=balanceByPublisher(rawArticles);
    const analysisArticles=balancedArticles.map(a=>{
      const text=a.title+' '+a.description;
      const newsCategory=classify(text);
      const newsSubcategory=classifySubcategory(newsCategory,text);
      return {...a,newsCategory,newsSubcategory};
    });
    const eventClusters=clusterEvents(analysisArticles);
    const articleCluster=new Map();
    for(const cluster of eventClusters)for(const id of cluster.articleIds)articleCluster.set(id,cluster.id);
    const clusterScore=new Map(eventClusters.map(x=>[x.id,Number(x.significanceScore)||0]));
    const articles=[...analysisArticles]
      .map(a=>({...a,eventClusterId:articleCluster.get(a.id)||''}))
      .sort((a,b)=>(clusterScore.get(b.eventClusterId)||0)-(clusterScore.get(a.eventClusterId)||0)||
        new Date(b.publishedAtFull||b.publishedAt)-new Date(a.publishedAtFull||a.publishedAt))
      .slice(0,160)
      .map(a=>({...a,significanceScore:clusterScore.get(a.eventClusterId)||0}));
    const counts=new Map(),subCounts=new Map();
    for(const a of analysisArticles){
      counts.set(a.newsCategory,(counts.get(a.newsCategory)||0)+1);
      if(a.newsSubcategory){
        const key=a.newsCategory+'|||'+a.newsSubcategory;
        subCounts.set(key,(subCounts.get(key)||0)+1);
      }
    }
    const categories=[...counts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
    const subcategories=[...subCounts.entries()].map(([key,count])=>{
      const [category,name]=key.split('|||');return{category,name,count};
    }).sort((a,b)=>b.count-a.count);
    const leaderEvidence=planet==='Sun'?buildLeaderEvidence(analysisArticles):[];
    const subjects=buildOrganicSubjects(analysisArticles);
    const sourceCounts=countSources(analysisArticles);
    const publisherCount=countPublishers(analysisArticles);
    const archiveSourceCount=Object.keys(sourceCounts).length;
    const archiveQuality=assessArchiveQuality({
      articleCount:analysisArticles.length,
      publisherCount,
      gdeltAvailable:gdeltCoverage.available,
      archiveSourceCount
    });
    return res.status(200).json({
      from,to,planet,future:false,count:analysisArticles.length,rawCount:rawArticles.length,publisherCount,archiveQuality,
      eventCount:eventClusters.length,eventClusters:eventClusters.slice(0,100),categories,subcategories,
      weightedCategories:buildWeightedCategories(eventClusters),subjects,articles,leaderEvidence,
      sourceCounts,
      sourceCoverage:{
        googleNews:{available:true,label:'Google News RSS',count:sourceCounts['Google News']||0},
        gdelt:{available:gdeltCoverage.available,label:'GDELT DOC 2.0',reason:gdeltCoverage.reason||'',count:sourceCounts['GDELT']||0},
        wikipediaCurrentEvents:{available:true,label:'Wikipedia Current Events',used:wikipediaFallbackUsed,count:sourceCounts['Wikipedia Current Events']||0}
      }
    });
  }catch(e){
    return res.status(500).json({error:'Transit news aggregation failed',detail:e?.message||String(e)});
  }
}

const HIST_ROOT_TO_CATEGORY={
  '01':'Communication / Messaging / Information','02':'Diplomacy / International Relations',
  '03':'Diplomacy / International Relations','04':'Diplomacy / International Relations',
  '05':'Diplomacy / International Relations','06':'Corporate Business / Mergers',
  '07':'Human Rights / Social Issues','08':'Diplomacy / International Relations',
  '09':'Courts / Legal Decisions','10':'Diplomacy / International Relations',
  '11':'Diplomacy / International Relations','12':'Diplomacy / International Relations',
  '13':'War / Military Conflict','14':'Protests / Civil Unrest',
  '15':'War / Military Conflict','16':'Diplomacy / International Relations',
  '17':'War / Military Conflict','18':'War / Military Conflict',
  '19':'War / Military Conflict','20':'War / Military Conflict'
};

async function buildHistoricalEventResponse(from,to,planet){
  const start=new Date(from+'T00:00:00Z'),end=new Date(to+'T00:00:00Z');
  const years=[];for(let y=start.getUTCFullYear();y<=end.getUTCFullYear();y++)years.push(y);
  const missingYears=[],days=[];
  for(const year of years){
    try{
      const file=path.join(process.cwd(),'data','gdelt-history',year+'.json');
      const payload=JSON.parse(await fs.readFile(file,'utf8'));
      for(const [day,row] of Object.entries(payload.days||{})){
        const iso=day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6,8);
        if(iso>=from&&iso<to)days.push({day:iso,...row});
      }
    }catch(_){missingYears.push(year)}
  }
  const rootCounts=new Map(),rootMentions=new Map(),eventCodeCounts=new Map(),eventCodeMentions=new Map(),actors=new Map(),actorPairs=new Map(),locations=new Map(),categoryCounts=new Map();
  let events=0,mentions=0,sources=0,articles=0,goldWeighted=0,toneWeighted=0;
  for(const d of days){
    events+=Number(d.events)||0;mentions+=Number(d.mentions)||0;sources+=Number(d.sources)||0;articles+=Number(d.articles)||0;
    goldWeighted+=(Number(d.avgGoldstein)||0)*(Number(d.events)||0);
    toneWeighted+=(Number(d.avgTone)||0)*(Number(d.events)||0);
    for(const r of d.roots||[]){
      rootCounts.set(r.code,(rootCounts.get(r.code)||0)+(Number(r.count)||0));
      rootMentions.set(r.code,(rootMentions.get(r.code)||0)+(Number(r.mentions)||0));
      const cat=HIST_ROOT_TO_CATEGORY[r.code]||'Other / Unclassified';
      categoryCounts.set(cat,(categoryCounts.get(cat)||0)+(Number(r.count)||0));
    }
    for(const e of d.eventCodes||[]){
      eventCodeCounts.set(e.code,(eventCodeCounts.get(e.code)||0)+(Number(e.count)||0));
      eventCodeMentions.set(e.code,(eventCodeMentions.get(e.code)||0)+(Number(e.mentions)||0));
    }
    for(const x of d.topActors||[])actors.set(x.name,(actors.get(x.name)||0)+(Number(x.count)||0));
    for(const x of d.topActorPairs||[])actorPairs.set(x.name,(actorPairs.get(x.name)||0)+(Number(x.count)||0));
    for(const x of d.topLocations||[])locations.set(x.name,(locations.get(x.name)||0)+(Number(x.count)||0));
  }
  const rootNames={
    '01':'Make Public Statement','02':'Appeal / Request','03':'Express Intent to Cooperate','04':'Consult',
    '05':'Diplomatic Cooperation','06':'Material Cooperation','07':'Provide Aid','08':'Yield / Concede',
    '09':'Investigate','10':'Demand','11':'Disapprove','12':'Reject','13':'Threaten','14':'Protest',
    '15':'Exhibit Force / Military Posture','16':'Reduce Relations','17':'Coerce','18':'Assault','19':'Fight',
    '20':'Unconventional Mass Violence'
  };
  const historicalEventTypes=[...rootCounts.entries()].map(([code,count])=>({
    code,name:rootNames[code]||code,count,mentions:rootMentions.get(code)||0
  })).sort((a,b)=>b.count-a.count);
  const categories=[...categoryCounts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
  const detailedEventCodes=[...eventCodeCounts.entries()].map(([code,count])=>({
    code,count,mentions:eventCodeMentions.get(code)||0,root:code.slice(0,2)
  })).sort((a,b)=>b.count-a.count);
  const subcategories=(detailedEventCodes.length?detailedEventCodes:historicalEventTypes).map(x=>({
    category:HIST_ROOT_TO_CATEGORY[x.root||x.code]||'Other / Unclassified',
    name:detailedEventCodes.length?'CAMEO '+x.code: x.name,
    count:x.count,
    code:x.code
  }));
  const topActors=[...actors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,count])=>({name,count}));
  const topActorPairs=[...actorPairs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,count])=>({name,count}));
  const topLocations=[...locations.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,count])=>({name,count}));
  const complete=missingYears.length===0;
  return{
    from,to,planet,future:false,mode:'historical-events',
    count:events,rawCount:events,publisherCount:0,eventCount:events,eventClusters:[],articles:[],
    categories,subcategories,subjects:[],leaderEvidence:[],
    historicalEventTypes,detailedEventCodes,
    historicalStats:{
      events,mentions,sources,articles,
      avgGoldstein:events?goldWeighted/events:0,
      avgTone:events?toneWeighted/events:0,
      topActors,topActorPairs,topLocations
    },
    archiveQuality:{
      level:complete&&events?'strong':'limited',
      analysisEligible:complete&&events>0,
      reason:complete
        ? 'GDELT 1.0 historical event index; event-coded data rather than a headline archive'
        : 'Historical GDELT index is not yet built for: '+missingYears.join(', ')
    },
    sourceCounts:{'GDELT 1.0 Events':events},
    sourceCoverage:{
      historical:{available:complete,label:'GDELT 1.0 Event Database',missingYears},
      googleNews:{available:false,label:'Google News RSS'},
      gdelt:{available:false,label:'GDELT DOC 2.0',reason:'Historical event mode'}
    }
  };
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
  const now=new Date();
  const cutoff=new Date(now.getTime()-366*86400000);
  const requestedStart=new Date(from+'T00:00:00Z');
  const requestedEnd=new Date(to+'T23:59:59Z');
  const effectiveStart=requestedStart<cutoff?cutoff:requestedStart;
  const effectiveEnd=requestedEnd>now?now:requestedEnd;
  if(effectiveEnd<=effectiveStart)return[];
  const start=gdeltStamp(effectiveStart);
  const end=gdeltStamp(effectiveEnd);
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
function gdeltStamp(d){
  const p=n=>String(n).padStart(2,'0');
  return d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds());
}
function parseGdeltDate(v){
  const s=String(v||'');
  const m=s.match(/^(\d{4})(\d{2})(\d{2})(?:T)?(\d{2})(\d{2})(\d{2})/);
  if(m)return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]));
  return new Date(s);
}
function wikiCurrentEventsPage(date){
  const month=date.toLocaleString('en-US',{month:'long',timeZone:'UTC'});
  return 'Portal:Current events/'+date.getUTCFullYear()+'_'+month+'_'+date.getUTCDate();
}
async function fetchWikipediaCurrentEvents(from,to){
  const start=new Date(from+'T00:00:00Z');
  const end=new Date(to+'T00:00:00Z');
  const dates=[];
  for(let d=new Date(start);d<end&&dates.length<31;d.setUTCDate(d.getUTCDate()+1))dates.push(new Date(d));
  const settled=await Promise.allSettled(dates.map(async date=>{
    const page=wikiCurrentEventsPage(date);
    const url='https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&page='+encodeURIComponent(page)+'&origin=*';
    const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'PlanetTransitNewsTracker/1.1'}});
    if(!r.ok)throw new Error('Wikipedia Current Events HTTP '+r.status);
    const json=await r.json();
    const html=String(json?.parse?.text||'');
    const blocks=[...html.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(m=>m[1]);
    const iso=date.toISOString().slice(0,10);
    const out=[];
    for(let i=0;i<blocks.length&&out.length<14;i++){
      const block=blocks[i];
      const external=block.match(/<a[^>]+href=["'](https?:\/\/[^"'#]+)["'][^>]*>/i);
      const title=clean(block);
      const link=external?.[1]||('https://en.wikipedia.org/wiki/'+encodeURIComponent(page.replace(/ /g,'_')));
      if(title.length<30||!safe(link))continue;
      out.push({
        id:'wiki-current-'+iso+'-'+i+'-'+hash(title),
        title:summary(title),
        description:'',
        source:'Wikipedia Current Events',
        url:safe(link),
        archiveSource:'Wikipedia Current Events',
        publishedAt:iso,
        publishedAtFull:iso+'T12:00:00.000Z'
      });
    }
    return out;
  }));
  const rows=[];
  for(const r of settled)if(r.status==='fulfilled')rows.push(...r.value);
  return dedupe(rows);
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
const CATEGORY_IMPACT={
  'War / Military Conflict':5,'Natural Disasters':5,'Severe Weather':5,'Nuclear / Power Infrastructure':5,
  'Disease / Outbreaks / Public Health':5,'Accidents / Industrial Disasters':4.5,'Crime / Public Safety':4,
  'Protests / Civil Unrest':4,'Economy / Growth / Recession':4,'Banking / Interest Rates / Monetary Policy':4,
  'Elections / Political Campaigns':4,'Government / Policy / Legislation':3.5,'Diplomacy / International Relations':3.5,
  'Courts / Legal Decisions':3.5,'Trade / Tariffs / Supply Chains':3.5,'Energy / Oil / Gas':3.5,
  'Cybersecurity / Hacking / Data Breaches':3.5,'Transportation / Aviation':3.5,'Human Rights / Social Issues':3.5
};
const TRUSTED_SOURCE_TERMS=['reuters','associated press',' ap ','bbc','cnn','npr','pbs','guardian','new york times','washington post','wall street journal','bloomberg','financial times','al jazeera','abc news','cbs news','nbc news','fox news','axios','politico','noaa','nasa','who','cdc','united nations'];
function trustedSource(a){
  const s=(' '+String(a?.source||'')+' '+String(a?.url||'')+' ').toLowerCase();
  return TRUSTED_SOURCE_TERMS.some(x=>s.includes(x));
}
function eventImpact(category){return CATEGORY_IMPACT[category]||2.5}
function eventScore(cluster){
  const headlineSignal=Math.log2(1+cluster.headlineCount)*7;
  const sourceSignal=Math.log2(1+cluster.sources.size)*12;
  const archiveSignal=Math.log2(1+cluster.archiveSources.size)*7;
  const trustedSignal=Math.min(18,cluster.trustedSources.size*4);
  const category=[...cluster.categories.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Other / Unclassified';
  const impactSignal=eventImpact(category)*8;
  return Math.round((headlineSignal+sourceSignal+archiveSignal+trustedSignal+impactSignal)*10)/10;
}
function clusterEvents(articles){
  const clusters=[];
  for(const article of articles){
    const tokens=eventTokens(article.title);
    let best=null,bestScore=0;
    for(const cluster of clusters){
      if(Math.abs(new Date(article.publishedAtFull||article.publishedAt)-new Date(cluster.latest))>4*86400000)continue;
      const score=jaccard(tokens,cluster.tokens);
      if(score>bestScore){bestScore=score;best=cluster}
    }
    if(best&&bestScore>=0.42){
      best.articleIds.push(article.id);
      best.headlineCount++;
      best.latest=laterIso(best.latest,article.publishedAtFull||article.publishedAt);
      for(const t of tokens)best.tokens.add(t);
      best.sources.add(article.source||'Unknown');
      best.archiveSources.add(article.archiveSource||'Unknown');
      if(trustedSource(article))best.trustedSources.add(article.source||article.url||article.id);
      best.categories.set(article.newsCategory,(best.categories.get(article.newsCategory)||0)+1);
      if((article.title||'').length<(best.title||'').length)best.title=article.title;
    }else{
      const categories=new Map();categories.set(article.newsCategory,1);
      clusters.push({
        id:'event-'+(clusters.length+1),
        title:article.title,
        earliest:article.publishedAtFull||article.publishedAt,
        latest:article.publishedAtFull||article.publishedAt,
        headlineCount:1,
        articleIds:[article.id],
        tokens:new Set(tokens),
        sources:new Set([article.source||'Unknown']),
        archiveSources:new Set([article.archiveSource||'Unknown']),
        trustedSources:new Set(trustedSource(article)?[article.source||article.url||article.id]:[]),
        categories
      });
    }
  }
  return clusters.map(c=>{
    const topCategory=[...c.categories.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Other / Unclassified';
    return{
      id:c.id,title:c.title,earliest:c.earliest,latest:c.latest,
      headlineCount:c.headlineCount,sourceCount:c.sources.size,archiveSourceCount:c.archiveSources.size,
      trustedSourceCount:c.trustedSources.size,articleIds:c.articleIds,topCategory,
      significanceScore:eventScore(c)
    };
  }).sort((a,b)=>b.significanceScore-a.significanceScore||b.sourceCount-a.sourceCount||b.headlineCount-a.headlineCount);
}
function eventTokens(title){
  return new Set(String(title||'').toLowerCase()
    .replace(/[^a-z0-9 ]+/g,' ')
    .split(/\s+/)
    .filter(x=>x.length>=4&&!SUBJECT_STOP.has(x)&&!/^[0-9]+$/.test(x)));
}
function jaccard(a,b){
  if(!a.size||!b.size)return 0;
  let inter=0;for(const x of a)if(b.has(x))inter++;
  return inter/(a.size+b.size-inter);
}
function laterIso(a,b){return new Date(a)>new Date(b)?a:b}

function buildWeightedCategories(clusters){
  const m=new Map();
  for(const e of clusters){
    const key=e.topCategory||'Other / Unclassified';
    const row=m.get(key)||{name:key,eventCount:0,score:0};
    row.eventCount++;
    row.score+=(Number(e.significanceScore)||0);
    m.set(key,row);
  }
  return [...m.values()]
    .map(x=>({...x,score:Math.round(x.score*10)/10}))
    .sort((a,b)=>b.score-a.score||b.eventCount-a.eventCount);
}
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
function balanceByPublisher(articles){
  if(articles.length<=24)return articles;
  const publishers=new Map();
  for(const a of articles){
    const key=publisherKey(a);
    if(!publishers.has(key))publishers.set(key,[]);
    publishers.get(key).push(a);
  }
  const publisherCount=Math.max(1,publishers.size);
  const cap=Math.max(3,Math.min(10,Math.ceil(articles.length/Math.max(8,publisherCount))));
  const out=[];
  for(const rows of publishers.values()){
    rows.sort((a,b)=>new Date(b.publishedAtFull||b.publishedAt)-new Date(a.publishedAtFull||a.publishedAt));
    out.push(...rows.slice(0,cap));
  }
  return out.sort((a,b)=>new Date(b.publishedAtFull||b.publishedAt)-new Date(a.publishedAtFull||a.publishedAt));
}
function publisherKey(a){
  const src=String(a.source||'').trim().toLowerCase();
  if(src)return src;
  try{return new URL(a.url||'').hostname.replace(/^www\./,'').toLowerCase()}catch{return'unknown'}
}
function countPublishers(articles){
  return new Set(articles.map(publisherKey).filter(Boolean)).size;
}
function assessArchiveQuality({articleCount,publisherCount,gdeltAvailable,archiveSourceCount=1}){
  if(articleCount<8||publisherCount<2){
    return{level:'limited',analysisEligible:false,reason:'Too few independent records for reliable comparison'};
  }
  if(articleCount>=24&&publisherCount>=8&&archiveSourceCount>=2){
    return{level:'strong',analysisEligible:true,reason:'Broad multi-source coverage with good publisher diversity'};
  }
  if(articleCount>=16&&publisherCount>=4){
    return{level:'moderate',analysisEligible:true,reason:archiveSourceCount>=2?'Usable multi-source coverage':'Usable coverage from a single archive family'};
  }
  if(articleCount>=10&&archiveSourceCount>=2){
    return{level:'moderate',analysisEligible:true,reason:'Multiple archives supplied enough dated events for comparison'};
  }
  return{level:'limited',analysisEligible:false,reason:gdeltAvailable?'Coverage remains sparse after fallback retrieval':'Archive coverage remains sparse after fallback retrieval'};
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
function classifySubcategory(category,text){
  const defs=SUBCATEGORIES[category];
  if(!defs)return'';
  const t=' '+String(text||'').toLowerCase()+' ';
  let best='',score=0;
  for(const [name,terms] of Object.entries(defs)){
    let n=0;for(const term of terms)if(t.includes(term))n++;
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
  if(p==='jupiter')return'Jupiter';
  if(p==='saturn')return'Saturn';
  if(p==='uranus')return'Uranus';
  if(p==='neptune')return'Neptune';
  if(p==='rahu')return'Rahu';
  if(p==='ketu')return'Ketu';
  return'Mercury';
}
