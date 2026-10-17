import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { MAX_PDF_BYTES, PUBLIC_ORIGIN, fail, httpsURL, canonicalURL, image2urlPDFURL, validSlug, metadata, validatePDF, duplicateGroups } from '../../../admin/domain.js';

const project = Deno.env.get('SUPABASE_URL')!;
const db = createClient(project, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false },global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(25000)})} });
const allowedOrigins = new Set([PUBLIC_ORIGIN, 'https://8apdf.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : PUBLIC_ORIGIN, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
const answer = (status: number, body: unknown, origin = '') => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
function check<T>(result: { data: T; error: any }): T {
  if (result.error) {
    const code = result.error.code;
    const status = code === '23505' ? 409 : ['40001','PT409'].includes(code) ? 409 : code === '42501' ? 403 : code === '28000' ? 401 : code === 'P0002' ? 404 : code === '54000' ? 429 : code === '23514' ? 422 : 500;
    fail(status === 500 ? 'Database operation failed. Retry after refreshing; contact the owner if this persists.' : code === '23505' ? 'That ID or short name already exists.' : result.error.message, status);
  }
  return result.data;
}
type Context = { actor: string; session: string; role: string };
async function authorize(req: Request): Promise<Context> {
  const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) fail('Sign in to the admin panel.', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) fail('Your session has expired. Sign in again.', 401);
  let session = '';
  try { session = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id; } catch { fail('Invalid session.', 401); }
  if (!/^[a-f0-9-]{36}$/i.test(session)) fail('Invalid session.', 401);
  const role = check(await db.rpc('admin_gate', { p_actor: data.user.id, p_session: session, p_write: true }));
  return { actor: data.user.id, session, role };
}
const tableOf = (value: unknown) => { if (!['study_materials', 'announcements', 'short_links', 'admin_audit_logs', 'admin_uploads', 'admin_file_links'].includes(String(value))) fail('Unknown collection.'); return String(value); };
const idOf = (value: unknown) => { if (typeof value !== 'string' || !/^[\w-]{1,200}$/.test(value)) fail('Invalid record ID.'); return value; };
const uuidOf = (value: unknown) => { if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) fail('Invalid upload ID.'); return value; };
async function mutate(ctx: Context, table: string, action: string, id: string, version: number | null, data: unknown = {}) {
  return check(await db.rpc('admin_mutate', { p_actor: ctx.actor, p_session: ctx.session, p_table: table, p_action: action, p_id: id, p_version: version, p_data: data }));
}
async function allRows(table: string, select = '*') {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const page: any = check(await db.from(table).select(select).order(table === 'short_links' ? 'slug' : 'id').range(offset, offset + 499));
    rows.push(...page); if (page.length < 500) return rows;
  }
}
async function one(table: string, id: string) { const row = check(await db.from(table).select('*').eq(table === 'short_links' ? 'slug' : 'id', id).maybeSingle()); if (!row) fail('Record no longer exists.', 404); return row; }
function listQuery(arg: any) {
  const table = tableOf(arg.table), page = Number(arg.page || 1), size = Number(arg.pageSize || 25);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(size) || size < 1 || size > 100) fail('Invalid page.');
  const source = table === 'study_materials' ? 'admin_materials_catalogue' : table;
  const selection = table === 'short_links' ? 'slug,document_id,url,title,created_at' : '*';
  let q = db.from(source).select(selection, { count: 'exact' });
  const search = String(arg.search || '').slice(0, 160).replace(/[,()."*%_\\]/g, ' ').trim();
  if (search) {
    const cols = table === 'short_links' ? ['slug', 'title', 'url'] : table === 'admin_audit_logs' ? ['action', 'record_id', 'record_type'] : table === 'admin_file_links' ? ['filename','storage_path'] : table === 'admin_uploads' ? ['filename', 'storage_path', 'error'] : ['title', 'description', 'subject', ...(table === 'study_materials' ? ['chapter'] : ['original_message', 'category'])];
    q = q.or(cols.map(k => `${k}.ilike.%${search}%`).join(','));
  }
  if (['study_materials', 'announcements'].includes(table)) {
    if (arg.status === 'archived') q = q.not('archived_at', 'is', null);
    else { q = q.is('archived_at', null); if (arg.status === 'published') q = q.eq('published', true); if (arg.status === 'draft') q = q.eq('published', false); }
    for (const field of ['subject', ...(table === 'study_materials' ? ['source', 'class_name', 'chapter'] : ['category'])]) if (arg[field]) q = q.eq(field, String(arg[field]).slice(0, 200));
    const date = table === 'study_materials' ? 'school_sort_at' : 'message_date';
    if (arg.from) { if (!/^\d{4}-\d{2}-\d{2}$/.test(arg.from)) fail('Invalid start date.'); q = q.gte(date, arg.from); }
    if (arg.to) { if (!/^\d{4}-\d{2}-\d{2}$/.test(arg.to)) fail('Invalid end date.'); q = q.lt(date, new Date(Date.parse(arg.to) + 86400000).toISOString()); }
    const sort = arg.sort === 'edited' ? 'updated_at' : arg.sort === 'inserted' ? 'inserted_at' : date;
    q = q.order(sort, { ascending: arg.sort === 'oldest', nullsFirst: false }).order('id');
  } else q = q.order('created_at', { ascending: false }).order(table === 'short_links' ? 'slug' : 'id');
  return { q: q.range((page - 1) * size, page * size - 1), page, size };
}
async function boundedBody(req:Pick<Request,'body'>,maximum:number){
  const reader=req.body?.getReader();if(!reader)fail('Request body is required.',400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader!.read();if(done)break;size+=value.length;if(size>maximum){await reader!.cancel();fail('Request is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new Blob([bytes]);
}
async function image2urlFile(value:unknown):Promise<File>{
  let url=image2urlPDFURL(value);if(!url)fail('Enter a public HTTPS PDF link from Image2URL.');
  for(let redirect=0;redirect<4;redirect++){
    const response:Response=await fetch(url!,{redirect:'manual',signal:AbortSignal.timeout(25000)});
    if([301,302,303,307,308].includes(response.status)){
      const location:string|null=response.headers.get('location');await response.body?.cancel();
      url=location?image2urlPDFURL(new URL(location,url!).href):null;
      if(!url)fail('The Image2URL redirect must stay on Image2URL.');continue;
    }
    if(!response.ok)fail('The Image2URL PDF could not be opened. Check that the link is public.');
    if(Number(response.headers.get('content-length')||0)>MAX_PDF_BYTES){await response.body?.cancel();fail('PDF must be at most 20 MB.',413);}
    const body=await boundedBody(response,MAX_PDF_BYTES);
    let filename='image2url-document.pdf';try{const name=decodeURIComponent(new URL(url!).pathname.split('/').at(-1)||'');if(/\.pdf$/i.test(name))filename=name;}catch{}
    return new File([body],filename,{type:'application/pdf'});
  }
  fail('The Image2URL link has too many redirects.');
}
async function uploadLinks(ctx:Context,record:any,target:string,input:any){
  if(target!=='study_materials')return {shortLink:null,shortLinkError:null,reusedShortLink:false};
  try{const result:any=check(await db.rpc('admin_upload_links',{p_actor:ctx.actor,p_session:ctx.session,p_record:record.id,p_slug:input.short_slug?validSlug(input.short_slug):null}));return {...result,shortLinkError:null,reusedShortLink:result.reused};}
  catch(e){return {shortLink:null,shortLinkError:(e as Error).message,reusedShortLink:false};}
}
async function upload(req: Request, ctx: Context, stage: (s:string)=>void = ()=>{}) {
  if (Number(req.headers.get('content-length') || 0) > MAX_PDF_BYTES + 100000) fail('Upload exceeds 20 MB.', 413);
  const body=await boundedBody(req,MAX_PDF_BYTES+100000);
  const form = await new Response(body,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();
  const uid = uuidOf(form.get('uploadId')), target = String(form.get('table') || 'study_materials');
  const recordId = form.get('recordId') ? idOf(form.get('recordId')) : uid;
  const recordVersion = form.get('recordId') ? Number(form.get('recordVersion')) : null;
  if(recordId!==uid && target!=='announcements') fail('Only announcement attachments can be replaced.');
  if (!['study_materials', 'announcements'].includes(target)) fail('Unsupported upload target.');
  let input: any;
  try { input = JSON.parse(String(form.get('metadata'))); } catch { fail('Upload metadata is invalid.'); }
  const details: any = metadata(target, input);
  stage('validating');
  const externalURL=input.image2url_url?image2urlPDFURL(input.image2url_url):null;
  if(input.image2url_url&&!externalURL)fail('Enter a public HTTPS PDF link from Image2URL.');
  if(externalURL&&target!=='study_materials')fail('Image2URL links are available for PDF library entries.');
  if(externalURL&&form.get('file') instanceof File)fail('Choose a PDF file or an Image2URL link.');
  const file=externalURL?await image2urlFile(externalURL):form.get('file') as File;
  const verified = await validatePDF(file);
  if (input.short_slug) { validSlug(input.short_slug); if (!details.published || target !== 'study_materials') fail('Publish the PDF before creating its short link.'); }
  let job: any = check(await db.from('admin_uploads').select('*').eq('id', uid).maybeSingle());
  if (job && (job.actor_id !== ctx.actor || job.checksum !== verified.checksum || job.record_type !== target || job.record_id!==recordId)) fail('Upload ID is already in use.', 409);
  if (!job) {
    const duplicates: any = check(await db.from('study_materials').select('id,title').eq('file_checksum', verified.checksum).is('archived_at', null).limit(1));
    if (target === 'study_materials' && duplicates.length && input.allow_duplicate !== true) fail(`Identical PDF already exists: ${duplicates[0].title}. Review duplicates or explicitly allow another entry.`, 409);
    if(externalURL){const rows:any=check(await db.from('study_materials').select('id,title').eq('pdf_url',externalURL).limit(1));if(rows.length&&input.allow_duplicate!==true)fail(`This PDF URL already exists: ${rows[0].title}.`,409);}
  }
  const proposedPath=externalURL?null:`${ctx.actor}/${uid}.pdf`;
  const reservation:any=check(await db.rpc('admin_upload_prepare',{p_actor:ctx.actor,p_session:ctx.session,p_upload:uid,p_checksum:verified.checksum,p_filename:verified.filename,p_size:file.size,p_table:target,p_record:recordId,p_url:externalURL||`${project}/storage/v1/object/public/study-pdfs/${proposedPath}`,p_path:proposedPath}));
  job=reservation.job;const path=reservation.asset.storage_path,publicURL=reservation.asset.pdf_url;
  if(job.state==='ready'){const record=await one(target,job.record_id);return {record,publicURL,uploadId:uid,recovered:true,reusedAsset:true,...await uploadLinks(ctx,record,target,input)};}
  try {
    // Idempotent UUID path. Never upsert or overwrite an existing Storage object.
    stage('uploading');
    if(path){const { error } = await db.storage.from('study-pdfs').upload(path, verified.bytes, { contentType: 'application/pdf', upsert: false, cacheControl: '3600' });
      if (error && error.message !== 'The resource already exists' && error.message !== 'The resource already exists.' && (error as any).statusCode !== '409') throw error;}
    stage('link');
    if(path){const verify = await fetch(publicURL, { headers: { Range: 'bytes=0-7' }, signal: AbortSignal.timeout(15000) });
      const signature = new Uint8Array(await verify.arrayBuffer());
      if (!verify.ok || !new TextDecoder().decode(signature.subarray(0, 5)).startsWith('%PDF-')) fail('Storage verification failed. Keep this file queued and retry.', 503);
    }else if(publicURL!==externalURL){const retained=await validatePDF(await image2urlFile(publicURL));if(retained.checksum!==verified.checksum)fail('The retained Image2URL PDF has changed. Review its link before reusing it.',409);}
    stage('saving');
    const existing: any = check(await db.from(target).select('*').eq('id', recordId).maybeSingle());
    let record: any;
    if (existing && recordId===uid) record = await one(target, uid);
    else {
      let recordURL=publicURL;
      if(target==='study_materials'){const used:any=check(await db.from(target).select('id').eq('pdf_url',publicURL).limit(1));if(used.length)recordURL=publicURL+'#8apdf-copy='+uid;}
      const data = target === 'study_materials' ? { ...details, pdf_url: recordURL, source: path?'Admin Upload':'Image2URL', storage_path: path, original_filename: verified.filename, file_checksum: verified.checksum, size_bytes: file.size } : { ...details, attachment_url: publicURL, has_attachment: true, storage_path: path, source: path?'Admin Upload':'Image2URL' };
      record = await mutate(ctx, target,recordId===uid?'create':'edit', recordId, recordVersion, data);
    }
    check(await db.from('admin_uploads').update({ state: 'ready', error: null, updated_at: new Date().toISOString() }).eq('id', uid));
    stage('publishing');
    const confirmed: any=await one(target,recordId);
    if (confirmed.storage_path!==path||canonicalURL(confirmed.pdf_url||confirmed.attachment_url)!==canonicalURL(publicURL)) fail('Upload recovery needs review: saved file does not match.',409);
    record=confirmed;
    const links=await uploadLinks(ctx,record,target,input);
    stage('ready');
    return { record, publicURL, uploadId: uid, ...links, reusedAsset:reservation.reused };
  } catch (e) {
    // Durable recovery record retains the object for retry. No delete after an
    // ambiguous DB response, which could otherwise remove a committed PDF.
    await db.from('admin_uploads').update({ state: 'failed', error: String((e as Error).message).slice(0, 300), updated_at: new Date().toISOString() }).eq('id', uid).neq('state', 'ready');
    throw e;
  }
}
async function perform(arg: any, ctx: Context) {
  const action = String(arg.action || 'session');
  if (action === 'session') return { role: ctx.role, userId: ctx.actor, maxPdfBytes: MAX_PDF_BYTES, preferences: check(await db.from('admin_preferences').select('preferences').eq('user_id', ctx.actor).maybeSingle())?.preferences || {} };
  if (action === 'list') { const { q, page, size } = listQuery(arg); const result = await q; check(result); const records=arg.table==='admin_file_links'?result.data?.map((r:any)=>({...r,public_url:db.storage.from('study-pdfs').getPublicUrl(r.storage_path).data.publicUrl})):result.data; return { records, total: result.count, page, pageSize: size }; }
  if (action === 'overview') {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const start = new Date(today + 'T00:00:00+05:30').toISOString();
    const [pdfs, announcements, links, uploads, activity, recent, notices, pdfToday, annToday, edited, failed] = await Promise.all([
      db.from('study_materials').select('id', { head: true, count: 'exact' }).is('archived_at', null), db.from('announcements').select('id', { head: true, count: 'exact' }).is('archived_at', null), db.from('short_links').select('slug', { head: true, count: 'exact' }),
      allRows('admin_uploads', 'id,size_bytes,state,storage_path'), db.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
      db.from('study_materials').select('*').is('archived_at', null).order('inserted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(6),
      db.from('announcements').select('*').is('archived_at', null).order('message_date', { ascending: false, nullsFirst: false }).limit(4),
      db.from('study_materials').select('id', { head: true, count: 'exact' }).gte('inserted_at', start), db.from('announcements').select('id', { head: true, count: 'exact' }).gte('inserted_at', start),
      db.from('admin_audit_logs').select('*').eq('action','updated').order('created_at',{ascending:false}).limit(5), db.from('admin_uploads').select('*').eq('state','failed').order('created_at',{ascending:false}).limit(5)
    ]);
    for (const result of [pdfs, announcements, links, activity, recent, notices, pdfToday, annToday, edited, failed]) check(result);
    return { pdfs: pdfs.count, announcements: announcements.count, links: links.count, pdfsToday: pdfToday.count, announcementsToday: annToday.count, storageBytes: [...new Map((uploads as any[]).filter(u=>u.storage_path&&u.state!=='deleted').map(u=>[u.storage_path,Number(u.size_bytes)])).values()].reduce((sum,size)=>sum+size,0), recent: recent.data, notices: notices.data, activity: activity.data, edited:edited.data, failed:failed.data, latestUpload: recent.data?.[0]?.inserted_at || null, syncErrors: null };
  }
  if (action === 'save') {
    const table = tableOf(arg.table); if (!['study_materials', 'announcements'].includes(table)) fail('Unsupported editor.');
    const data: any = metadata(table, arg.data, !!arg.id);
    if (!arg.id && table === 'study_materials') fail('Use the PDF upload workflow to add a document.');
    const id=arg.id?idOf(arg.id):arg.createId?uuidOf(arg.createId):crypto.randomUUID();
    if(!arg.id&&arg.createId){
      const existing:any=check(await db.from(table).select('*').eq('id',id).maybeSingle());
      if(existing){
        const own:any=check(await db.from('admin_audit_logs').select('id').eq('actor_id',ctx.actor).eq('record_type',table).eq('record_id',id).eq('action','created').limit(1));
        if(!own.length)fail('This request ID is already in use.',409);
        return {record:existing,recovered:true};
      }
    }
    return { record: await mutate(ctx, table, arg.id ? 'edit' : 'create', id, arg.version ?? null, data) };
  }
  if (action === 'bulk') {
    const table = tableOf(arg.table); if (!['study_materials', 'announcements'].includes(table)) fail('Unsupported collection.');
    if (!Array.isArray(arg.items) || !arg.items.length || arg.items.length > 50) fail('Select 1–50 records per batch.');
    const operation = String(arg.operation), results = [];
    if (!['archive', 'restore', 'delete', 'publish', 'unpublish', 'subject', 'category'].includes(operation)) fail('Unknown batch action.');
    if (['archive', 'delete'].includes(operation) && arg.confirm !== `${operation.toUpperCase()} ${arg.items.length}`) fail('Explicit batch confirmation is required.');
    for (const item of arg.items) {
      try {
        const patch = operation === 'publish' ? { published: true } : operation === 'unpublish' ? { published: false } : ['subject','category'].includes(operation) ? metadata(table, { [operation]: arg.value }, true) : {};
        const record = await mutate(ctx, table, ['publish', 'unpublish','subject','category'].includes(operation) ? 'edit' : operation, idOf(item.id), item.version, patch);
        results.push({ id: item.id, ok: true, record });
      } catch (e) { results.push({ id: item.id, ok: false, error: (e as Error).message }); }
    }
    return { results };
  }
  if (action === 'duplicate') {
    const table = tableOf(arg.table); if (!['study_materials', 'announcements'].includes(table) || arg.confirm !== 'DUPLICATE') fail('Confirm the intentional duplicate.');
    const row: any = await one(table, idOf(arg.id));
    const base=Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null));
    if(table==='announcements'&&!base.original_message&&row.raw?.originalMessage)base.original_message=row.raw.originalMessage;
    const data: any = metadata(table, { ...base, title: row.title + ' (copy)', published: false });
    const copyId=crypto.randomUUID();
    // The existing automation relies on the UNIQUE(pdf_url) index. A fragment
    // distinguishes an intentional reference copy without changing the fetched
    // file, path case or query. Duplicate detection ignores fragments.
    if(table==='study_materials'){
      const url=new URL(data.pdf_url);url.hash=(url.hash?url.hash.slice(1)+'&':'')+'8apdf-copy='+copyId;data.pdf_url=url.href;
    }
    if(row.storage_path) data.storage_path=row.storage_path;
    if(table==='study_materials')for(const key of ['original_filename','file_checksum','size_bytes'])if(row[key]!=null)data[key]=row[key];
    return { record: await mutate(ctx, table, 'create', copyId, null, data) };
  }
  if (action === 'export') {
    const table = tableOf(arg.table); if (!['study_materials','announcements'].includes(table) || !Array.isArray(arg.ids) || arg.ids.length > 100) fail('Select up to 100 records to export.');
    return { records: check(await db.from(table).select('*').in('id', arg.ids.map(idOf))) };
  }
  if (action === 'duplicates') {
    let records: any[] = await allRows('study_materials'); records = records.filter(r => !r.archived_at);
    if (Array.isArray(arg.ids) && arg.ids.length) records = records.filter(r => arg.ids.includes(r.id));
    const ignores: any = check(await db.from('admin_duplicate_ignores').select('group_key'));
    const ignored = new Set(ignores.map((r: any) => r.group_key));
    const links = await allRows('short_links','slug,document_id,url,title,created_at');
    return { groups: duplicateGroups(records, arg.strictness).filter(g => arg.showIgnored || !ignored.has(g.id)).map(g => ({ ...g, ignored: ignored.has(g.id), records: g.records.map((r: any) => ({ ...r, links: links.filter(l => l.document_id === r.id || l.url === r.pdf_url) })) })), scanned: records.length };
  }
  if (action === 'ignore') {
    if (typeof arg.groupKey !== 'string' || arg.groupKey.length > 20000) fail('Invalid duplicate group.');
    if (arg.restore) check(await db.from('admin_duplicate_ignores').delete().eq('group_key', arg.groupKey));
    else check(await db.from('admin_duplicate_ignores').upsert({ group_key: arg.groupKey, actor_id: ctx.actor }));
    return { saved: true };
  }
  if (action === 'merge') {
    const keep: any = await one('study_materials', idOf(arg.keep)), from: any = await one('study_materials', idOf(arg.from));
    if (arg.confirm !== 'MERGE') fail('Review and confirm the metadata merge.');
    const patch: any = {};
    for (const field of ['description','subject','chapter','class_name','source_date']) if (!keep[field] && from[field]) patch[field] = from[field];
    patch.tags = [...new Set([...(keep.tags || []), ...(from.tags || [])])].slice(0,30);
    return { record: await mutate(ctx,'study_materials','edit',keep.id,arg.version,metadata('study_materials',patch,true)) };
  }
  if (action === 'link_create') {
    const row: any = await one('study_materials', idOf(arg.documentId));
    if (!row.published || row.archived_at || !httpsURL(row.pdf_url) || (arg.pdfUrl && arg.pdfUrl !== row.pdf_url)) fail('Choose a published PDF from the live library.');
    return { record: await mutate(ctx, 'short_links', 'create', validSlug(arg.slug), null, { document_id: row.id, url: row.pdf_url, title: row.title }) };
  }
  if (action === 'link_delete') { if (arg.confirm !== 'DELETE ' + arg.slug) fail('Confirm short-link deletion.'); return await mutate(ctx, 'short_links', 'delete', validSlug(arg.slug), null); }
  if (action === 'link_transfer') {
    const keeper: any = await one('study_materials', idOf(arg.documentId));
    if (arg.confirm !== 'TRANSFER') fail('Confirm destination-preserving transfer.');
    return { record: await mutate(ctx,'short_links','transfer',validSlug(arg.slug),null,{ document_id:keeper.id,url:keeper.pdf_url }) };
  }
  if(action==='link_candidates'){
    const link:any=await one('short_links',validSlug(arg.slug));
    const rows=await allRows('study_materials','id,title,pdf_url,published,archived_at');
    return {records:rows.filter(r=>r.id!==link.document_id&&r.published&&!r.archived_at&&canonicalURL(r.pdf_url)===canonicalURL(link.url))};
  }
  if (action === 'link_health') {
    const link: any = await one('short_links',validSlug(arg.slug));
    const row: any = link.document_id ? check(await db.from('study_materials').select('id,pdf_url,published,archived_at').eq('id',link.document_id).maybeSingle()) : null;
    let accessible = null;
    if (link.url.startsWith(project + '/storage/v1/object/public/study-pdfs/')) { const r = await fetch(link.url,{method:'HEAD',signal:AbortSignal.timeout(10000)}); accessible = r.ok; }
    return { verifiedRecord: !!row && row.pdf_url === link.url, published: !!row?.published && !row?.archived_at, accessible, message: accessible === false ? 'Storage file is missing or inaccessible.' : !row ? 'Standalone short URL. Its original destination is preserved independently of the library record.' : row.pdf_url !== link.url ? 'Saved destination differs from the library record. Review manually.' : accessible === true ? 'Storage PDF is accessible.' : 'Library destination matches. External host availability is unverified; open the PDF to check.' };
  }
  if (action === 'storage_delete') {
    if (arg.confirm !== 'DELETE FILE') fail('Confirm permanent file cleanup.');
    if(arg.storagePath!==undefined&&(typeof arg.storagePath!=='string'||!arg.storagePath||arg.storagePath.length>1024))fail('Choose a valid hosted PDF file.');
    const path = arg.storagePath!==undefined?check(await db.rpc('admin_file_claim',{p_actor:ctx.actor,p_session:ctx.session,p_path:arg.storagePath})):check(await db.rpc('admin_storage_claim', { p_actor:ctx.actor,p_session:ctx.session,p_upload:uuidOf(arg.uploadId) }));
    const result = await db.storage.from('study-pdfs').remove([path]); check(result);
    check(await db.from('admin_uploads').update({state:'deleted',updated_at:new Date().toISOString()}).eq('storage_path',path)); return {deleted:true};
  }
  if (action === 'preferences') {
    const p = arg.preferences || {}, safe: any = {};
    for (const [key, options] of Object.entries({ pdfSort:['newest','oldest','edited','inserted'],announcementSort:['newest','oldest','edited','inserted'],duplicateStrictness:['exact','balanced','broad'],theme:['dark','light'],defaultPublished:[true,false],notifications:[true,false],reducedMotion:[true,false] })) { if (key in p) { if (!(options as any[]).includes(p[key])) fail('Invalid preference: '+key); safe[key]=p[key]; } }
    if ('defaultSubject' in p) safe.defaultSubject = String(p.defaultSubject).trim().slice(0,120);
    check(await db.from('admin_preferences').upsert({user_id:ctx.actor,preferences:safe})); return {preferences:safe};
  }
  fail('Unknown admin action.',400);
}
export async function handler(req: Request) {
  const origin = req.headers.get('Origin') || '';
  if (origin && !allowedOrigins.has(origin)) return answer(403,{error:'Use the official admin panel.'},origin);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
  if (req.method !== 'POST') return answer(405,{error:'POST required.'},origin);
  try {
    const ctx = await authorize(req);
    if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) {
      const encoder=new TextEncoder();
      const stream=new ReadableStream({async start(controller){
        const emit=(value:unknown)=>{try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{/* disconnected client; durable upload recovery remains available */}};
        try{const result=await upload(req,ctx,s=>emit({stage:s}));emit({ok:true,...result});}
        catch(e){const ex=e as any;emit({ok:false,error:ex.status?ex.message:'Upload could not complete. Check Storage and retry the same queued file.'});}
        finally{try{controller.close();}catch{}}
      }});
      return new Response(stream,{headers:{...cors(origin),'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    const raw = await (await boundedBody(req,100000)).text();
    let input: any; try { input = JSON.parse(raw); } catch { fail('Invalid JSON.',400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('JSON object required.',400);
    return answer(200,{ok:true,...await perform(input,ctx)},origin);
  } catch (e) {
    const ex = e as any, status = ex.status || 500;
    if (status === 500) console.error('Admin operation failed:', ex?.name, String(ex?.message || '').slice(0,150));
    return answer(status,{ok:false,error:status === 500 ? 'The operation could not be completed. Refresh and retry; check Activity and Storage for recovery details.' : ex.message},origin);
  }
}
Deno.serve(handler);
