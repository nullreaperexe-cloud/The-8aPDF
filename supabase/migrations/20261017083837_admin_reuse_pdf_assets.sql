-- One canonical public URL per byte-identical PDF, independent of catalogue
-- records. Upload requests keep their own UUID for durable retry recovery.
create table public.admin_pdf_assets (
  checksum text primary key check(checksum ~ '^[a-f0-9]{64}$'),
  pdf_url text not null check(pdf_url ~ '^https://'), storage_path text,
  created_by uuid, created_at timestamptz not null default now()
);
alter table public.admin_pdf_assets enable row level security;
revoke all on public.admin_pdf_assets from public,anon,authenticated;
grant all on public.admin_pdf_assets to service_role;

insert into public.admin_pdf_assets(checksum,pdf_url,storage_path)
select distinct on(checksum) checksum,'https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'||storage_path,storage_path
from public.admin_uploads where checksum ~ '^[a-f0-9]{64}$' order by checksum,created_at,id
on conflict do nothing;
insert into public.admin_pdf_assets(checksum,pdf_url,storage_path)
select distinct on(file_checksum) file_checksum,split_part(pdf_url,'#',1),storage_path
from public.study_materials where file_checksum ~ '^[a-f0-9]{64}$' order by file_checksum,inserted_at nulls last,id
on conflict do nothing;
insert into public.admin_pdf_assets(checksum,pdf_url,storage_path)
select distinct on(data->>'file_checksum') data->>'file_checksum',split_part(data->>'pdf_url','#',1),data->>'storage_path'
from public.admin_deleted_records where record_type='study_materials' and data->>'file_checksum' ~ '^[a-f0-9]{64}$' and data->>'pdf_url' ~ '^https://' order by data->>'file_checksum',deleted_at,id
on conflict do nothing;

alter table public.admin_uploads drop constraint admin_uploads_storage_path_key;
alter table public.admin_uploads alter column storage_path drop not null;
alter table public.admin_uploads add column pdf_url text;
update public.admin_uploads set pdf_url='https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'||storage_path;
create index admin_uploads_storage_path on public.admin_uploads(storage_path);
create index admin_uploads_checksum on public.admin_uploads(checksum);

create function public.admin_upload_prepare(p_actor uuid,p_session uuid,p_upload uuid,p_checksum text,p_filename text,p_size bigint,p_table text,p_record text,p_url text,p_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.admin_uploads; asset public.admin_pdf_assets; reused boolean; exists_record boolean;
begin
  perform public.admin_gate(p_actor,p_session,false);
  if p_table not in ('study_materials','announcements') or p_checksum !~ '^[a-f0-9]{64}$' or p_size<1 or p_size>20971520 or p_url !~ '^https://' then raise exception 'Invalid upload reservation' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  select * into job from public.admin_uploads where id=p_upload for update;
  if found then
    if job.actor_id<>p_actor or job.checksum<>p_checksum or job.record_type<>p_table or job.record_id<>p_record then raise exception 'Upload ID is already in use' using errcode='23505'; end if;
    if job.state in ('deleting','deleted') then raise exception 'This upload was cleaned up. Add the file again.' using errcode='PT409'; end if;
  end if;
  select * into asset from public.admin_pdf_assets where checksum=p_checksum;
  reused:=found;
  if not reused then
    -- Also cover an upload that completed while this migration was deploying.
    insert into public.admin_pdf_assets(checksum,pdf_url,storage_path)
    select checksum,coalesce(pdf_url,'https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'||storage_path),storage_path
    from public.admin_uploads where checksum=p_checksum and (pdf_url is not null or storage_path is not null) order by created_at,id limit 1 on conflict do nothing;
    select * into asset from public.admin_pdf_assets where checksum=p_checksum;reused:=found;
  end if;
  if not reused then
    insert into public.admin_pdf_assets(checksum,pdf_url,storage_path,created_by) values(p_checksum,p_url,p_path,p_actor) returning * into asset;
  end if;
  if asset.storage_path is not null and exists(select 1 from public.admin_uploads where storage_path=asset.storage_path and state='deleting') then raise exception 'This file is being removed. Retry after cleanup finishes.' using errcode='PT409'; end if;
  if job.id is null then
    insert into public.admin_uploads(id,actor_id,storage_path,filename,size_bytes,checksum,record_id,record_type,pdf_url)
    values(p_upload,p_actor,asset.storage_path,p_filename,p_size,p_checksum,p_record,p_table,asset.pdf_url) returning * into job;
  else
    execute format('select exists(select 1 from public.%I where id=$1)',p_table) into exists_record using p_record;
    if job.state<>'ready' or not exists_record then
      update public.admin_uploads set state='pending',error=null,updated_at=now() where id=p_upload returning * into job;
    end if;
  end if;
  return jsonb_build_object('job',to_jsonb(job),'asset',to_jsonb(asset),'reused',reused);
end $$;
revoke all on function public.admin_upload_prepare(uuid,uuid,uuid,text,text,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_upload_prepare(uuid,uuid,uuid,text,text,bigint,text,text,text,text) to service_role;

create function public.admin_upload_links(p_actor uuid,p_session uuid,p_record text,p_slug text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare doc public.study_materials; saved public.short_links; reused boolean:=true;
begin
  perform public.admin_gate(p_actor,p_session,false);
  perform set_config('apdf.actor',p_actor::text,true);
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  select * into doc from public.study_materials where id=p_record for update;
  if not found then raise exception 'Record no longer exists' using errcode='P0002'; end if;
  select * into saved from public.short_links where split_part(url,'#',1)=split_part(doc.pdf_url,'#',1) order by created_at,slug limit 1;
  if found then
    if doc.published and doc.archived_at is null then
      update public.short_links set document_id=doc.id where document_id is null and split_part(url,'#',1)=split_part(doc.pdf_url,'#',1);
    end if;
    select * into saved from public.short_links where slug=saved.slug;
  elsif p_slug is not null then
    perform public.admin_mutate(p_actor,p_session,'short_links','create',p_slug,null,jsonb_build_object('document_id',doc.id,'url',doc.pdf_url,'title',doc.title));
    select * into saved from public.short_links where slug=p_slug; reused:=false;
  end if;
  return jsonb_build_object('shortLink',case when saved.slug is null then null else to_jsonb(saved)-'owner_hash' end,'reused',saved.slug is not null and reused);
end $$;
revoke all on function public.admin_upload_links(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_upload_links(uuid,uuid,text,text) to service_role;

-- Multiple upload requests can now reference one physical file. Keep a single
-- inventory row per actual object and keep its original display filename.
create or replace view public.admin_file_links with (security_invoker=true) as
select o.id::text as id,o.name as storage_path,coalesce(u.filename,o.name) as filename,
  o.created_at,coalesce((o.metadata->>'size')::bigint,u.size_bytes,0) as size_bytes,
  (select count(*) from public.study_materials m where m.storage_path=o.name or admin_private.pdf_file_path(m.pdf_url)=o.name)
   +(select count(*) from public.announcements a where a.storage_path=o.name or admin_private.pdf_file_path(a.attachment_url)=o.name) as record_references,
  (select count(*) from public.short_links l where admin_private.pdf_file_path(l.url)=o.name) as short_link_references
from storage.objects o left join lateral(select filename,size_bytes from public.admin_uploads where storage_path=o.name order by created_at,id limit 1) u on true
where o.bucket_id='study-pdfs';

-- External PDF entries have no Supabase storage path.
create or replace function public.admin_mutate(p_actor uuid,p_session uuid,p_table text,p_action text,p_id text,p_version integer default null,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; prior jsonb; result jsonb; patch jsonb:=p_data; allowed text[]; assignments text; key text; oid text;
begin
  r:=public.admin_gate(p_actor,p_session,false);
  perform set_config('apdf.actor',p_actor::text,true);
  if p_table not in ('study_materials','announcements','short_links') then raise exception 'Unsupported collection'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  oid:=case when p_table='short_links' then 'slug' else 'id' end;
  execute format('select to_jsonb(t) from public.%I t where %I=$1 for update',p_table,oid) into prior using p_id;
  if p_action<>'create' and prior is null then raise exception 'Record no longer exists' using errcode='P0002'; end if;
  if p_table='short_links' then
    if p_action='delete' then
      execute 'delete from public.short_links where slug=$1' using p_id; return jsonb_build_object('deleted',true,'id',p_id);
    elsif p_action='create' then
      insert into public.short_links(slug,document_id,url,title) values(p_id,patch->>'document_id',patch->>'url',patch->>'title') returning to_jsonb(short_links)-'owner_hash' into result; return result;
    elsif p_action='transfer' then
      if split_part(patch->>'url','#',1) is distinct from split_part(prior->>'url','#',1) then raise exception 'Only identical URL destinations can be transferred' using errcode='23514'; end if;
      update public.short_links set document_id=patch->>'document_id' where slug=p_id returning to_jsonb(short_links)-'owner_hash' into result; return result;
    else raise exception 'Unsupported link action'; end if;
  end if;
  if p_action<>'create' and (p_version is null or (prior->>'version')::integer<>p_version) then raise exception 'Record changed. Refresh before saving.' using errcode='PT409'; end if;
  if p_action='delete' then
    if r<>'super_admin' then raise exception 'Permanent deletion requires Super Admin' using errcode='42501'; end if;
    insert into public.admin_deleted_records(record_type,record_id,data,actor_id) values(p_table,p_id,prior,p_actor);
    execute format('delete from public.%I where id=$1',p_table) using p_id;
    return jsonb_build_object('deleted',true,'id',p_id);
  end if;
  allowed:=case when p_table='study_materials' then array['title','description','subject','chapter','class_name','term','source_date','source','tags','pdf_url','published','storage_path','original_filename','file_checksum','size_bytes']
    else array['title','description','subject','category','original_message','priority','message_date','attachment_url','has_attachment','published','storage_path','source'] end;
  for key in select jsonb_object_keys(patch) loop if not key=any(allowed) then raise exception 'Field is not editable: %',key; end if; end loop;
  if (p_action='archive' and prior->>'archived_at' is not null) or (p_action='restore' and prior->>'archived_at' is null) then return prior-'raw'-'admin_edited_fields'; end if;
  if p_action='archive' then patch:=jsonb_build_object('archived_at',now(),'archive_published',coalesce((prior->>'published')::boolean,false),'published',false);
  elsif p_action='restore' then patch:=jsonb_build_object('archived_at',null,'published',coalesce((prior->>'archive_published')::boolean,false));
  elsif p_action not in ('create','edit') then raise exception 'Unsupported action'; end if;
  if p_action in ('create','edit') then
    if patch ? 'title' and (length(trim(patch->>'title'))<1 or length(patch->>'title')>500) then raise exception 'Title is required'; end if;
    if patch ? 'pdf_url' and patch->>'pdf_url' !~ '^https://' then raise exception 'HTTPS PDF required'; end if;
    if patch ? 'storage_path' and patch->>'storage_path' is not null and not exists(select 1 from public.admin_uploads where storage_path=patch->>'storage_path' and state in ('pending','ready')) then raise exception 'Upload is unavailable'; end if;
  end if;
  if p_action='create' then
    if prior is not null then raise exception 'Record ID already exists' using errcode='23505'; end if;
    if p_table='study_materials' and (patch->>'pdf_url' is null or patch->>'title' is null) then raise exception 'PDF and title required'; end if;
    patch:=jsonb_build_object('published',false,'raw','{}'::jsonb,'created_at',now(),'updated_at',now())||patch||jsonb_build_object('id',p_id,'version',1,'admin_edited_fields',array(select jsonb_object_keys(p_data)));
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I)',p_table,p_table,p_table) into result using patch;
  else
    if prior->>'archived_at' is not null and p_action='edit' and patch->>'published'='true' then raise exception 'Restore this record before publishing'; end if;
    patch:=patch||jsonb_build_object('admin_edited_fields',array(select distinct v from unnest(array(select jsonb_array_elements_text(prior->'admin_edited_fields'))||array(select jsonb_object_keys(patch))) v));
    select string_agg(format('%I=p.%I',v,v),',') into assignments from jsonb_object_keys(patch) v;
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) p where t.id=$2 returning to_jsonb(t)',p_table,assignments,p_table) into result using prior||patch,p_id;
  end if;
  return result-'raw'-'admin_edited_fields';
end $$;
-- Reserve reused files against cleanup while their new record is being saved.
create or replace function public.admin_file_claim(p_actor uuid,p_session uuid,p_path text) returns text
language plpgsql security invoker set search_path='' as $$
declare role_name text;
begin
  role_name:=public.admin_gate(p_actor,p_session,false);
  if role_name<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  if exists(select 1 from public.admin_uploads where storage_path=p_path and state='pending') then raise exception 'An upload is using this file. Retry cleanup after it finishes.' using errcode='PT409'; end if;
  if not exists(select 1 from storage.objects where bucket_id='study-pdfs' and name=p_path)
    and not exists(select 1 from public.admin_uploads where storage_path=p_path and state in ('ready','failed','deleting')) then
    raise exception 'Hosted PDF file no longer exists' using errcode='P0002';
  end if;
  if exists(select 1 from public.study_materials where storage_path=p_path or admin_private.pdf_file_path(pdf_url)=p_path)
    or exists(select 1 from public.announcements where storage_path=p_path or admin_private.pdf_file_path(attachment_url)=p_path) then
    raise exception 'Delete the PDF or announcement records using this file first. Their short URLs and files are kept.' using errcode='23514';
  end if;
  if exists(select 1 from public.short_links where admin_private.pdf_file_path(url)=p_path) then
    raise exception 'Delete the short URLs using this file in Link Manager first, then delete the Supabase file URL.' using errcode='23514';
  end if;
  update public.admin_uploads set state='deleting',updated_at=now() where storage_path=p_path;
  insert into public.admin_audit_logs(actor_id,action,record_type,record_id) values(p_actor,'storage_cleanup_requested','storage',p_path);
  return p_path;
end $$;
