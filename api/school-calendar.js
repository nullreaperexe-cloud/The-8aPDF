import {readFileSync} from 'node:fs';
import {calendarDay,addDays,dateKey,dateMs} from '../shared/school-calendar-core.js';
const fallback=JSON.parse(readFileSync(new URL('../data/school-calendar.json',import.meta.url),'utf8'));

// One published configuration is used for the home day indicator, the calendar,
// and every device. Only confirmed EduSecure cards may add non-weekly closures.
async function getConfiguration(){
 const url=process.env.CALENDAR_SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.CALENDAR_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return fallback;
 try{
  const response=await fetch(url+'/rest/v1/calendar_state?key=eq.current&select=config&limit=1',{
   headers:{apikey:key,Authorization:'Bearer '+key},
   signal:AbortSignal.timeout(6000),cache:'no-store'
  });
  if(!response.ok)throw new Error('Supabase calendar read failed');
  const row=(await response.json())[0];
  const config=row?.config;
  if(!config?.anchor?.date||!Array.isArray(config.holidays))throw new Error('Missing authoritative calendar');
  return config;
 }catch(error){
  console.error('Calendar using read-only repository fallback:',error?.message);
  return fallback;
 }
}
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET'});}
 try{
  const config=await getConfiguration(),currentDate=dateKey();
  const date=req.query?.date&&req.query.date!=='current'?req.query.date:currentDate;
  dateMs(date);
  const from=req.query?.from||config.start,to=req.query?.to||config.end;
  dateMs(from);dateMs(to);
  if(to<from)throw new Error('Invalid interval');
  const calendar=[];
  for(let d=from;d<=to&&calendar.length<800;d=addDays(d,1)){
   calendar.push(calendarDay(d,config));
  }
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  return res.status(200).json({config,currentDate,today:calendarDay(date,config),calendar});
 }catch(error){return res.status(400).json({error:'Invalid school calendar date'});}
}