/**
 * Published school announcements from the migrated 8aPDF Supabase project.
 * Uses the project's public publishable key under read-only RLS.
 */
import {SUPABASE_PROJECT_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-materials.js';

export const SUPABASE_ANNOUNCEMENTS_URL=SUPABASE_PROJECT_URL+'/rest/v1/announcements';

export async function listSupabaseAnnouncements({limit=500,offset=0,id=null,fetchImpl=fetch}={}){
 const size=Number(limit),start=Number(offset);
 if(!Number.isSafeInteger(size)||size<1||size>1000)throw new RangeError('Invalid Supabase announcements page size');
 if(!Number.isSafeInteger(start)||start<0||start>1000000)throw new RangeError('Invalid Supabase announcements offset');
 const url=new URL(SUPABASE_ANNOUNCEMENTS_URL);
 url.searchParams.set('select','*');
 url.searchParams.set('limit',String(size));
 if(id!==null&&id!==undefined)url.searchParams.set('id','eq.'+String(id));
 else{
  url.searchParams.set('offset',String(start));
  url.searchParams.set('order','created_at.desc.nullslast,id.asc');
 }
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const res=await fetchImpl(url.toString(),{
   method:'GET',
   headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'},
   cache:'no-store',signal:controller.signal
  });
  if(!res.ok){
   let code='';
   try{const body=await res.json();code=String(body?.code||'')}catch{}
   throw new Error('Supabase announcements read failed (HTTP '+res.status+(code?', code '+code:'')+')');
  }
  const data=await res.json();
  if(!Array.isArray(data))throw new Error('Supabase announcements returned invalid JSON');
  return data;
 }finally{clearTimeout(timer)}
}
export async function fetchAllSupabaseAnnouncements({pageSize=500,maxRows=20000,fetchImpl=fetch}={}){
 const size=Number(pageSize),max=Number(maxRows);
 if(!Number.isSafeInteger(size)||size<1||size>1000||!Number.isSafeInteger(max)||max<1||max>100000)
  throw new RangeError('Invalid Supabase announcements pagination');
 const all=[];
 for(let offset=0;offset<max;offset+=size){
  const requestSize=Math.min(size,max-offset);
  const rows=await listSupabaseAnnouncements({limit:requestSize,offset,fetchImpl});
  all.push(...rows);
  if(rows.length<requestSize)return all;
 }
 if((await listSupabaseAnnouncements({limit:1,offset:max,fetchImpl})).length)
  throw new Error('Supabase announcements limit reached');
 return all;
}
/** Restore Firestore-compatible announcement fields from their original raw JSON. */
export function normalizeSupabaseAnnouncement(row){
 if(!row||typeof row!=='object')return {};
 const original=row.raw&&typeof row.raw==='object'&&!Array.isArray(row.raw)?row.raw:{};
 const edited=new Set(Array.isArray(row.admin_edited_fields)?row.admin_edited_fields:[]);
 const pick=(column,legacy,fallback)=>edited.has(column)?(row[column]??fallback):(original[legacy]??row[column]??fallback);
 return {
  ...original,
  id:String(row.id),
  // The normalized database title is authoritative. Legacy raw.title can be
  // a truncated EduSecure preview even after the title column was corrected.
  // Admin edits are also persisted in row.title, so this preserves them.
  title:String(row.title||original.title||'School announcement'),
  subject:pick('subject','subject','General'),
  category:pick('category','category','General'),
  description:pick('description','description',''),
  published:row.published??original.published??true,
  createdAt:original.createdAt??row.created_at??null,
  messageDate:pick('message_date','messageDate',null),
  originalMessage:pick('original_message','originalMessage',''),
  // The existing student announcement reader consumes `message` and
  // `hasAttachment`; keep its contract when content comes from the admin API.
  message:pick('original_message','originalMessage',original.message??original.fullMessage??row.description??''),
  attachmentUrl:pick('attachment_url','attachmentUrl',''),
  hasAttachment:Boolean(pick('has_attachment','hasAttachment',Boolean(row.attachment_url||original.attachmentUrl))),
  sourceMessageId:original.sourceMessageId??row.source_message_id??String(row.id),
  priority:pick('priority','priority','normal')
 };
}
