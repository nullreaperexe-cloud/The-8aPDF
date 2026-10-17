-- Only owner-designated Super Admins may change content. Verified signups view it.
alter table public.admin_users drop constraint admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check(role in ('viewer','admin','super_admin'));
update public.admin_users set role='viewer' where role='admin';
create or replace function public.admin_gate(p_actor uuid,p_session uuid,p_write boolean default false) returns text
language plpgsql security invoker set search_path='' as $$
declare r text; n integer;
begin
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now())) then raise exception 'Session expired' using errcode='28000'; end if;
  if not exists(select 1 from auth.users where id=p_actor and email is not null and email_confirmed_at is not null) then raise exception 'Verify your email before accessing the admin panel' using errcode='42501'; end if;
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    insert into public.admin_users(user_id,role)
      select u.id,coalesce(p.role,'viewer') from auth.users u left join admin_private.pending_admins p on lower(u.email)=p.email
      where u.id=p_actor on conflict(user_id) do nothing;
  end if;
  select role into r from public.admin_users where user_id=p_actor and enabled;
  if r is null then raise exception 'This account has been disabled. Contact the site owner.' using errcode='42501'; end if;
  delete from admin_private.pending_admins where email=(select lower(email) from auth.users where id=p_actor);
  if p_write and r='viewer' then raise exception 'View-only access. A Super Admin must make this change.' using errcode='42501'; end if;
  if p_write then
    delete from admin_private.rate_limits where window_start<now()-interval '10 minutes';
    insert into admin_private.rate_limits values(p_actor,date_trunc('minute',now()),1)
      on conflict(actor_id,window_start) do update set hits=admin_private.rate_limits.hits+1 returning hits into n;
    if n>90 then raise exception 'Too many actions. Try again in a minute.' using errcode='54000'; end if;
  end if;
  return r;
end $$;

create or replace function public.admin_mutate(p_actor uuid,p_session uuid,p_table text,p_action text,p_id text,p_version integer default null,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; prior jsonb; result jsonb; patch jsonb:=p_data; allowed text[]; assignments text; key text; oid text;
begin
  r:=public.admin_gate(p_actor,p_session,true);
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
create or replace function public.admin_upload_prepare(p_actor uuid,p_session uuid,p_upload uuid,p_checksum text,p_filename text,p_size bigint,p_table text,p_record text,p_url text,p_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.admin_uploads; asset public.admin_pdf_assets; reused boolean; exists_record boolean;
begin
  perform public.admin_gate(p_actor,p_session,true);
  if p_table not in ('study_materials','announcements') or p_checksum !~ '^[a-f0-9]{64}$' or p_size<1 or p_size>20971520 or p_url !~ '^https://' then raise exception 'Invalid upload reservation' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  select * into job from public.admin_uploads where id=p_upload for update;
  if found then
    if job.actor_id<>p_actor or job.checksum<>p_checksum or job.record_type<>p_table or job.record_id<>p_record then raise exception 'Upload ID is already in use' using errcode='23505'; end if;
    if job.state='deleting' then raise exception 'This file is being removed. Retry after deletion finishes.' using errcode='PT409'; end if;
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

create function public.admin_access_list(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if public.admin_gate(p_actor,p_session,false)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 return jsonb_build_object('records',coalesce((select jsonb_agg(r order by r.email) from (
   select u.email,a.role,a.enabled,false as pending,lower(u.email)='nullreaper.exe@gmail.com' as owner
   from public.admin_users a join auth.users u on u.id=a.user_id
   union all select p.email,p.role,true,true,false from admin_private.pending_admins p
   where not exists(select 1 from auth.users u join public.admin_users a on a.user_id=u.id where lower(u.email)=p.email)
 ) r),'[]'::jsonb));
end $$;
create function public.admin_access_set(p_actor uuid,p_session uuid,p_email text,p_role text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare email_value text:=lower(trim(p_email)); target_id uuid;
begin
 if public.admin_gate(p_actor,p_session,true)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 if p_role not in ('viewer','super_admin') or email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Choose a valid email and role' using errcode='23514'; end if;
 if email_value='nullreaper.exe@gmail.com' and p_role<>'super_admin' then raise exception 'The site owner keeps Super Admin access' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('8apdf-access'));
 select id into target_id from auth.users where lower(email)=email_value;
 if target_id is null then
   if p_role='super_admin' then insert into admin_private.pending_admins(email,role) values(email_value,p_role) on conflict(email) do update set role=excluded.role;
   else delete from admin_private.pending_admins where email=email_value; end if;
 else
   insert into public.admin_users(user_id,role,enabled) values(target_id,p_role,true) on conflict(user_id) do update set role=excluded.role,enabled=true;
   delete from admin_private.pending_admins where email=email_value;
 end if;
 insert into public.admin_audit_logs(actor_id,action,record_type,record_id,after_data) values(p_actor,'access_changed','admin_users',email_value,jsonb_build_object('role',p_role,'pending',target_id is null));
 return jsonb_build_object('email',email_value,'role',p_role,'pending',target_id is null);
end $$;
revoke all on function public.admin_access_list(uuid,uuid),public.admin_access_set(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_access_list(uuid,uuid),public.admin_access_set(uuid,uuid,text,text) to service_role;
