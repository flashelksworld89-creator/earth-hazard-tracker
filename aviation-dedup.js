/* Conservative aviation event deduplication; original articles retained in local storage. */
(function(){
'use strict';
const KEY='aviation-duplicate-archive-v1';
const read=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch{return[]}};
const write=a=>localStorage.setItem(KEY,JSON.stringify(a));
const day=r=>String(r.eventAt||r.publishedAt||'').slice(0,10);
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const registration=r=>{
 const t=(r.title||'')+' '+(r.description||'');
 const m=t.match(/\b(?:registration|registered|tail(?: number)?|reg(?:istration)?[.:# ]+)\s*[:#-]?\s*([A-Z]{1,2}-[A-Z0-9]{3,6}|N[0-9]{1,5}[A-Z]{0,2})\b/i);
 return m?m[1].toUpperCase():'';
};
const flight=r=>{
 const t=(r.title||'')+' '+(r.description||'');
 const m=t.match(/\b(?:flight|flt)\s*(?:number|no\.?|#)?\s*([A-Z]{2,3})[ -]?(\d{2,4})\b/i);
 return m?m[1].toUpperCase()+m[2]:'';
};
const type=r=>(r.categories||[]).includes('Crash / Collision')?'crash':'other';
function comparison(a,b){
 if(!day(a)||day(a)!==day(b)||type(a)!==type(b))return null;
 const ar=registration(a),br=registration(b),af=flight(a),bf=flight(b);
 if(ar&&br&&ar!==br)return null;
 if(af&&bf&&af!==bf)return null;
 if(ar&&br&&ar===br)return{level:'strong',why:'Same registration, UTC date and incident category'};
 const al=norm(a.locationText||a.geo?.displayName),bl=norm(b.locationText||b.geo?.displayName);
 if(af&&bf&&af===bf&&al&&bl&&al===bl)return{level:'strong',why:'Same flight number, location, UTC date and incident category'};
 if(af&&bf&&af===bf)return{level:'review',why:'Same flight number and UTC date'};
 if(al&&bl&&al===bl){
   const aa=norm(a.aircraftType),bb=norm(b.aircraftType);
   if(aa&&bb&&aa===bb&&aa!=='unspecified aircraft')return{level:'review',why:'Same location, aircraft type, date and incident category'};
 }
 return null;
}
function find(candidate,records){
 const matches=records.map((r,i)=>({r,i,match:comparison(candidate,r)})).filter(x=>x.match);
 return matches.find(x=>x.match.level==='strong')||matches[0]||null;
}
function archiveDuplicate(record,canonical,reason){
 const a=read();
 if(!a.some(x=>x.record.key===record.key)){
   a.push({record,canonicalKey:canonical.key,reason,reviewedAt:new Date().toISOString()});
   write(a);
 }
}
function process(record,records){
 const match=find(record,records);
 if(match&&match.match.level==='strong'){
   archiveDuplicate(record,match.r,match.match.why);
   return false;
 }
 return true;
}
function render(records,onChanged){
 const el=document.getElementById('duplicateReview');if(!el)return;
 const archived=read();
 const pairs=[];
 for(let i=0;i<records.length;i++){
   const m=find(records[i],records.slice(0,i));
   if(m)pairs.push({first:m.r,second:records[i],match:m.match});
 }
 const total=pairs.length;
 const rows=pairs.slice(0,100).map((p,i)=>{
   const id=records.indexOf(p.second);
   return '<div class="focus-card" style="margin:8px 0"><small>'+escapeHtml(p.match.level==='strong'?'Strong match — review':'Possible duplicate')+' · '+escapeHtml(p.match.why)+'</small>'+
     '<p>'+escapeHtml(day(p.first))+' · '+escapeHtml(p.first.title)+' · '+escapeHtml(p.first.source||'')+'</p>'+
     '<p>'+escapeHtml(p.second.title)+' · '+escapeHtml(p.second.source||'')+'</p>'+
     '<button type="button" data-duplicate-index="'+id+'">Mark second article as duplicate</button></div>';
 }).join('');
 el.innerHTML='<p>'+records.length+' counted records · '+total+' candidate pairs · '+archived.length+' archived duplicate articles. Nothing is removed automatically from historical counts. Review each pair before consolidating.</p>'+
   '<button type="button" id="exportIncidentBackup">Export complete backup</button> '+
   (archived.length?'<button type="button" id="undoIncidentDuplicate">Undo most recent consolidation</button>':'')+
   (rows||'<p>No likely duplicate pairs detected using available identifiers.</p>')+
   (total>100?'<p>Showing first 100 candidate pairs.</p>':'');
 el.querySelectorAll('[data-duplicate-index]').forEach(btn=>btn.addEventListener('click',()=>{
   const index=Number(btn.dataset.duplicateIndex);
   const r=records[index];
   if(!r)return;
   const m=find(r,records.slice(0,index));if(!m)return;
   if(!confirm('Count only the first incident? The second article will be archived locally, not deleted.'))return;
   archiveDuplicate(r,m.r,m.match.why+' · manually confirmed');
   records.splice(index,1);onChanged();
 }));
 const backup=el.querySelector('#exportIncidentBackup');
 backup.onclick=()=>{
   const blob=new Blob([JSON.stringify({countedIncidents:records,archivedArticles:read(),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aviation-incidents-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const undo=el.querySelector('#undoIncidentDuplicate');
 if(undo)undo.onclick=()=>{
   const a=read(),last=a.pop();if(!last)return;
   if(!records.some(r=>r.key===last.record.key))records.push(last.record);
   write(a);onChanged();
 };
}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* Analytical event identity: separate reported articles from counted events.
   Never automatically merge merely on city, date, headline, or aircraft class. */
function dateDistance(a,b){
 const x=Date.parse(day(a)+'T00:00:00Z'),y=Date.parse(day(b)+'T00:00:00Z');
 return Number.isFinite(x)&&Number.isFinite(y)?Math.abs(x-y)/86400000:Infinity;
}
function eventIdentityMatch(a,b){
 if(dateDistance(a,b)>3)return false;
 const ar=registration(a),br=registration(b),af=flight(a),bf=flight(b);
 if(ar&&br&&ar!==br)return false;
 if(af&&bf&&af!==bf)return false;
 if(ar&&br&&ar===br)return true;
 if(af&&bf&&af===bf){
   const al=norm(a.locationText||a.geo?.displayName),bl=norm(b.locationText||b.geo?.displayName);
   return !!(al&&bl&&al===bl);
 }
 return false;
}
function eventGroups(records){
 const groups=[];
 const ordered=[...records].sort((a,b)=>String(a.publishedAt||a.eventAt).localeCompare(String(b.publishedAt||b.eventAt)));
 for(const r of ordered){
   let group=groups.find(g=>g.articles.some(other=>eventIdentityMatch(r,other)));
   if(!group){group={articles:[]};groups.push(group)}
   group.articles.push(r);
 }
 return groups.map((g,i)=>{
   const preferred=[...g.articles].sort((a,b)=>{
     const score=r=>(r.timeConfidence==='reported'?3:r.timeConfidence==='inferred'?2:0)+(r.geo?.found?1:0);
     return score(b)-score(a)||String(a.publishedAt||'').localeCompare(String(b.publishedAt||''));
   })[0];
   return {id:'event-'+i,record:preferred,articles:g.articles};
 });
}
function countedEvents(records){return eventGroups(records).map(g=>g.record)}
window.aviationDedup={process,render,read,eventGroups,countedEvents};
})();