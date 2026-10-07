#!/usr/bin/env python3
import argparse, csv, io, json, os, sys, urllib.request, zipfile
from collections import Counter, defaultdict
from datetime import datetime

BASE="https://data.gdeltproject.org/events/"
ROOT_LABELS={
"01":"Make Public Statement","02":"Appeal / Request","03":"Express Intent to Cooperate",
"04":"Consult","05":"Diplomatic Cooperation","06":"Material Cooperation","07":"Provide Aid",
"08":"Yield / Concede","09":"Investigate","10":"Demand","11":"Disapprove",
"12":"Reject","13":"Threaten","14":"Protest","15":"Exhibit Force / Military Posture",
"16":"Reduce Relations","17":"Coerce","18":"Assault","19":"Fight",
"20":"Unconventional Mass Violence"
}

def sources_for_year(year):
    if year <= 2005:
        return [f"{year}.zip"]
    if year <= 2012:
        return [f"{year}{m:02d}.zip" for m in range(1,13)]
    if year == 2013:
        # Jan-Mar are monthly backfiles; Apr-Dec are daily frontfiles.
        names=[f"2013{m:02d}.zip" for m in range(1,4)]
        d=datetime(2013,4,1)
        while d.year==2013:
            names.append(d.strftime("%Y%m%d")+".export.CSV.zip")
            from datetime import timedelta
            d += timedelta(days=1)
        return names
    raise ValueError("This builder is intended for 1979-2013 GDELT 1.0 archives.")

def download(url):
    req=urllib.request.Request(url,headers={"User-Agent":"EarthHazardTracker-HistoricalIndexer/1.0"})
    with urllib.request.urlopen(req,timeout=120) as r:
        return r.read()

def num(v, default=0.0):
    try:return float(v)
    except:return default

def integer(v, default=0):
    try:return int(float(v))
    except:return default

def process_member(fp, days):
    reader=csv.reader(io.TextIOWrapper(fp,encoding="utf-8",errors="replace"),delimiter="\t")
    for row in reader:
        if len(row)<35: continue
        day=row[1].strip()
        if len(day)!=8 or not day.isdigit(): continue
        root=row[28].strip().zfill(2)
        if root not in ROOT_LABELS: continue
        quad=integer(row[29])
        gold=num(row[30])
        mentions=integer(row[31])
        sources=integer(row[32])
        articles=integer(row[33])
        tone=num(row[34])
        actor1=(row[6] if len(row)>6 else "").strip()
        actor2=(row[16] if len(row)>16 else "").strip()
        # Action geography starts at col 49 in GDELT 1.0 front/back schemas.
        loc=(row[50] if len(row)>50 else "").strip()
        country=(row[51] if len(row)>51 else "").strip()

        d=days[day]
        d["events"]+=1
        d["mentions"]+=mentions
        d["sources"]+=sources
        d["articles"]+=articles
        d["goldstein_sum"]+=gold
        d["tone_sum"]+=tone
        d["roots"][root]+=1
        d["root_mentions"][root]+=mentions
        d["quads"][str(quad)]+=1
        if actor1:d["actors"][actor1]+=1
        if actor2:d["actors"][actor2]+=1
        if loc:d["locations"][loc]+=1
        elif country:d["locations"][country]+=1

def finalize(days):
    out={}
    for day,d in sorted(days.items()):
        n=max(1,d["events"])
        out[day]={
            "events":d["events"],"mentions":d["mentions"],"sources":d["sources"],"articles":d["articles"],
            "avgGoldstein":round(d["goldstein_sum"]/n,3),"avgTone":round(d["tone_sum"]/n,3),
            "roots":[{"code":k,"name":ROOT_LABELS[k],"count":v,"mentions":d["root_mentions"][k]}
                     for k,v in d["roots"].most_common()],
            "quads":dict(d["quads"]),
            "topActors":[{"name":k,"count":v} for k,v in d["actors"].most_common(12)],
            "topLocations":[{"name":k,"count":v} for k,v in d["locations"].most_common(12)]
        }
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--year",type=int,required=True)
    ap.add_argument("--outdir",default="data/gdelt-history")
    args=ap.parse_args()
    os.makedirs(args.outdir,exist_ok=True)
    days=defaultdict(lambda:{
        "events":0,"mentions":0,"sources":0,"articles":0,"goldstein_sum":0.0,"tone_sum":0.0,
        "roots":Counter(),"root_mentions":Counter(),"quads":Counter(),"actors":Counter(),"locations":Counter()
    })
    ok=0
    for name in sources_for_year(args.year):
        url=BASE+name
        try:
            blob=download(url)
        except Exception as e:
            print(f"WARN {name}: {e}",file=sys.stderr)
            continue
        try:
            with zipfile.ZipFile(io.BytesIO(blob)) as z:
                for member in z.namelist():
                    if member.endswith("/"):continue
                    with z.open(member) as fp: process_member(fp,days)
            ok+=1
            print(f"processed {name}",file=sys.stderr)
        except Exception as e:
            print(f"WARN parse {name}: {e}",file=sys.stderr)
    payload={
      "year":args.year,
      "source":"GDELT 1.0 Event Database",
      "eventTaxonomy":"CAMEO root event codes",
      "filesProcessed":ok,
      "days":finalize(days)
    }
    path=os.path.join(args.outdir,f"{args.year}.json")
    with open(path,"w",encoding="utf-8") as f: json.dump(payload,f,separators=(",",":"))
    print(path)

if __name__=="__main__": main()
