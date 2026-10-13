import {readFileSync} from 'node:fs';
import {calendarDay,addDays,dateKey,holidaysFromNotices} from '../shared/school-calendar-core.js';
const base=JSON.parse(readFileSync(new URL('../data/school-calendar.json',import.meta.url),'utf8'));
let cached=null,expires=0;
const decode=value=>value?.stringValue??value?.timestampValue??(value?.integerValue?Number(value.integerValue):value?.booleanValue??null);
async function configuration(){
 if(cached&&Date.now()<expires)return cached;
 let holidays=[],noticeSync='unavailable';
 try{
  const url='https://firestore.googleapis.com/v1/projects/academyvault-5d1eb/databases/(default)/documents:runQuery';
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'announcements'}],where:{fieldFilter:{field:{fieldPath:'published'},op:'EQUAL',value:{booleanValue:true}}},orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:180}}),signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('School notice sync unavailable');
  const rows=await response.json();holidays=holidaysFromNotices(rows.filter(r=>r.document).map(r=>({id:r.document.name.split('/').at(-1),...Object.fromEntries(Object.entries(r.document.fields||{}).map(([k,v])=>[k,decode(v)]))})));noticeSync='synced';
 }catch{}
 cached={...base,holidays:[...base.holidays,...holidays],noticeSync};expires=Date.now()+300000;return cached;
}
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
 try{
  const config=await configuration(),date=req.query?.date||dateKey(),day=calendarDay(date,config),from=req.query?.from||base.start,to=req.query?.to||base.end;
  // Bounded, complete school calendar, not a weekday-to-cycle-day shortcut.
  const dates=[];for(let d=from;d<=to&&dates.length<800;d=addDays(d,1))dates.push(calendarDay(d,config));
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return res.status(200).json({config,today:day,calendar:dates});
 }catch(error){return res.status(400).json({error:'Invalid school calendar date'});}
}
