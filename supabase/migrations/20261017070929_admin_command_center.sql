-- Additive migration. Existing IDs, source dates and raw JSON are preserved.
begin;
create schema if not exists admin_private;
revoke all on schema admin_private from public, anon, authenticated;
grant usage on schema admin_private to service_role;
grant usage on schema auth to service_role;
grant select(id,user_id,not_after) on auth.sessions to service_role;
grant select(id,email,email_confirmed_at) on auth.users to service_role;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, record_type text not null, record_id text not null,
  before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table public.admin_deleted_records (
  id bigint generated always as identity primary key,
  record_type text not null, record_id text not null, data jsonb not null,
  actor_id uuid not null, deleted_at timestamptz not null default now()
);
create table public.admin_uploads (
  id uuid primary key, actor_id uuid not null, storage_path text not null unique,
  filename text not null, size_bytes bigint not null, checksum text not null,
  state text not null default 'pending' check (state in ('pending','ready','failed','deleting','deleted')),
  record_id text, record_type text, error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.admin_duplicate_ignores (
  group_key text primary key, actor_id uuid not null, created_at timestamptz not null default now()
);
create table public.admin_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb
);
create table admin_private.rate_limits (
  actor_id uuid not null, window_start timestamptz not null, hits integer not null,
  primary key(actor_id,window_start)
);
create table admin_private.pending_admins(email text primary key, role text not null check(role in ('admin','super_admin')));
insert into admin_private.pending_admins(email,role) values ('nullreaper.exe@gmail.com','super_admin');
do $$ declare t text; begin
  foreach t in array array['admin_users','admin_audit_logs','admin_deleted_records','admin_uploads','admin_duplicate_ignores','admin_preferences'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant all on all sequences in schema public to service_role;

alter table public.study_materials
  add column archived_at timestamptz,
  add column archive_published boolean,
  add column inserted_at timestamptz,
  add column version integer not null default 1,
  add column storage_path text,
  add column original_filename text,
  add column file_checksum text,
  add column size_bytes bigint,
  add column admin_edited_fields text[] not null default '{}';
alter table public.announcements
  add column archived_at timestamptz,
  add column archive_published boolean,
  add column inserted_at timestamptz,
  add column updated_at timestamptz,
  add column source text,
  add column version integer not null default 1,
  add column storage_path text,
  add column admin_edited_fields text[] not null default '{}';

-- Explicit public read rules; writes remain server-only, including Storage.
drop policy "Published study materials are publicly readable" on public.study_materials;
create policy "Published study materials are publicly readable" on public.study_materials for select to anon,authenticated using (published is true and archived_at is null);
drop policy "Public can read published school announcements" on public.announcements;
create policy "Public can read published school announcements" on public.announcements for select to anon,authenticated using (published is true and archived_at is null);
revoke insert,update,delete,truncate on public.study_materials,public.announcements,public.short_links from anon,authenticated;
revoke all on public.short_links from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('study-pdfs','study-pdfs',true,20971520,array['application/pdf']) on conflict(id) do nothing;
-- No client INSERT/UPDATE/DELETE storage policies: validated Edge backend only.
create index admin_materials_source_date_idx on public.study_materials(source_date desc nulls last,id);
create index admin_materials_inserted_idx on public.study_materials(inserted_at desc nulls last,id);
create index admin_announcements_date_idx on public.announcements(message_date desc nulls last,id);
create index admin_logs_created_idx on public.admin_audit_logs(created_at desc,id);
create index admin_links_document_idx on public.short_links(document_id);

create function admin_private.safe_timestamp(value text) returns timestamptz language plpgsql stable set search_path='' as $$
begin return value::timestamptz; exception when others then return null; end $$;
create view public.admin_materials_catalogue with (security_invoker=true) as
 select m.*,coalesce(m.source_date,admin_private.safe_timestamp(m.date_iso),admin_private.safe_timestamp(m.created_at)) school_sort_at from public.study_materials m;
revoke all on public.admin_materials_catalogue from public,anon,authenticated;
grant select on public.admin_materials_catalogue to service_role;

create function admin_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare actor text := nullif(current_setting('apdf.actor',true),''); oldj jsonb; newj jsonb; k text;
begin
  if TG_OP='INSERT' then new.inserted_at:=now(); return new; end if;
  if TG_OP='DELETE' then
    if TG_TABLE_NAME='study_materials' then
      perform pg_advisory_xact_lock(hashtext('8apdf-links'));
      if exists(select 1 from public.short_links where document_id=old.id or url=old.pdf_url) then raise exception 'Active short links must be reviewed before deleting this PDF' using errcode='23514'; end if;
    end if;
    return old;
  end if;
  oldj:=to_jsonb(old); newj:=to_jsonb(new);
  -- Automation can refresh untouched fields, but cannot overwrite an admin edit.
  if actor is null then
    foreach k in array old.admin_edited_fields loop newj:=jsonb_set(newj,array[k],coalesce(oldj->k,'null'::jsonb)); end loop;
    newj:=newj||jsonb_build_object('archived_at',old.archived_at,'archive_published',old.archive_published,'inserted_at',old.inserted_at,'admin_edited_fields',old.admin_edited_fields);
    if old.archived_at is not null then newj:=newj||'{"published":false}'::jsonb; end if;
    new:=jsonb_populate_record(new,newj);
  end if;
  if TG_TABLE_NAME='study_materials' and newj->>'pdf_url' is distinct from oldj->>'pdf_url' then
    perform pg_advisory_xact_lock(hashtext('8apdf-links'));
    if exists(select 1 from public.short_links where document_id=old.id or url=oldj->>'pdf_url') then raise exception 'A shared short link protects this saved PDF URL' using errcode='23514'; end if;
  end if;
  new.inserted_at:=old.inserted_at;
  new.version:=old.version+1; new.updated_at:=now();
  return new;
end $$;
create function admin_private.audit_record() returns trigger language plpgsql set search_path='' as $$
declare actor uuid := nullif(current_setting('apdf.actor',true),'')::uuid; beforej jsonb; afterj jsonb; verb text;
begin
  if TG_OP<>'INSERT' then beforej:=to_jsonb(old); end if;
  if TG_OP<>'DELETE' then afterj:=to_jsonb(new); end if;
  verb:=case when TG_OP='INSERT' then 'created' when TG_OP='DELETE' then 'deleted'
    when beforej->>'archived_at' is null and afterj->>'archived_at' is not null then 'archived'
    when beforej->>'archived_at' is not null and afterj->>'archived_at' is null then 'restored' else 'updated' end;
  insert into public.admin_audit_logs(actor_id,action,record_type,record_id,before_data,after_data)
  values(actor,verb,TG_TABLE_NAME,coalesce(afterj->>'id',beforej->>'id',afterj->>'slug',beforej->>'slug'),beforej-'raw'-'owner_hash',afterj-'raw'-'owner_hash');
  return coalesce(new,old);
end $$;
create trigger admin_guard_material before insert or update or delete on public.study_materials for each row execute function admin_private.guard_record();
create trigger admin_guard_announcement before insert or update or delete on public.announcements for each row execute function admin_private.guard_record();
create trigger admin_audit_material after insert or update or delete on public.study_materials for each row execute function admin_private.audit_record();
create trigger admin_audit_announcement after insert or update or delete on public.announcements for each row execute function admin_private.audit_record();
create trigger admin_audit_link after insert or update or delete on public.short_links for each row execute function admin_private.audit_record();
create function admin_private.guard_link() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  if TG_OP<>'DELETE' and new.document_id is not null then
    if not exists(select 1 from public.study_materials where id=new.document_id and pdf_url=new.url and published=true and archived_at is null) then
      raise exception 'Short links require a matching published library record' using errcode='23514';
    end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger admin_guard_link before insert or update on public.short_links for each row execute function admin_private.guard_link();

-- This invoker RPC is callable only by service_role. It rechecks session revocation
-- and role in PostgreSQL; no user-provided JWT metadata is trusted for roles.
create function public.admin_gate(p_actor uuid,p_session uuid,p_write boolean default false) returns text
language plpgsql security invoker set search_path='' as $$
declare r text; n integer;
begin
  select role into r from public.admin_users where user_id=p_actor and enabled;
  if r is null and not exists(select 1 from public.admin_users where user_id=p_actor) then
    insert into public.admin_users(user_id,role)
      select u.id,p.role from auth.users u join admin_private.pending_admins p on lower(u.email)=p.email
      where u.id=p_actor and u.email_confirmed_at is not null
      on conflict(user_id) do nothing;
    select role into r from public.admin_users where user_id=p_actor and enabled;
    if r is not null then delete from admin_private.pending_admins where email=(select lower(email) from auth.users where id=p_actor); end if;
  end if;
  if r is null then raise exception 'Access denied' using errcode='42501'; end if;
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now())) then raise exception 'Session expired' using errcode='28000'; end if;
  if p_write then
    delete from admin_private.rate_limits where window_start<now()-interval '10 minutes';
    insert into admin_private.rate_limits values(p_actor,date_trunc('minute',now()),1)
      on conflict(actor_id,window_start) do update set hits=admin_private.rate_limits.hits+1 returning hits into n;
    if n>90 then raise exception 'Too many actions. Try again in a minute.' using errcode='54000'; end if;
  end if;
  return r;
end $$;

create function public.admin_mutate(p_actor uuid,p_session uuid,p_table text,p_action text,p_id text,p_version integer default null,p_data jsonb default '{}') returns jsonb
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
      if patch->>'url' is distinct from prior->>'url' then raise exception 'Only identical URL destinations can be transferred' using errcode='23514'; end if;
      update public.short_links set document_id=patch->>'document_id' where slug=p_id returning to_jsonb(short_links)-'owner_hash' into result; return result;
    else raise exception 'Unsupported link action'; end if;
  end if;
  if p_action<>'create' and (p_version is null or (prior->>'version')::integer<>p_version) then raise exception 'Record changed. Refresh before saving.' using errcode='40001'; end if;
  if p_action='delete' then
    if r<>'super_admin' then raise exception 'Permanent deletion requires Super Admin' using errcode='42501'; end if;
    if prior->>'archived_at' is null then raise exception 'Archive the record before permanent deletion' using errcode='23514'; end if;
    insert into public.admin_deleted_records(record_type,record_id,data,actor_id) values(p_table,p_id,prior,p_actor);
    execute format('delete from public.%I where id=$1',p_table) using p_id;
    return jsonb_build_object('deleted',true,'id',p_id);
  end if;
  allowed:=case when p_table='study_materials' then array['title','description','subject','chapter','class_name','term','source_date','source','tags','pdf_url','published','storage_path','original_filename','file_checksum','size_bytes']
    else array['title','description','subject','category','original_message','priority','message_date','attachment_url','has_attachment','published','storage_path','source'] end;
  for key in select jsonb_object_keys(patch) loop if not key=any(allowed) then raise exception 'Field is not editable: %',key; end if; end loop;
  if p_action='archive' then patch:=jsonb_build_object('archived_at',now(),'archive_published',coalesce((prior->>'published')::boolean,false),'published',false);
  elsif p_action='restore' then patch:=jsonb_build_object('archived_at',null,'published',coalesce((prior->>'archive_published')::boolean,false));
  elsif p_action not in ('create','edit') then raise exception 'Unsupported action'; end if;
  if p_action in ('create','edit') then
    if patch ? 'title' and (length(trim(patch->>'title'))<1 or length(patch->>'title')>500) then raise exception 'Title is required'; end if;
    if patch ? 'pdf_url' and patch->>'pdf_url' !~ '^https://' then raise exception 'HTTPS PDF required'; end if;
    if patch ? 'storage_path' and not exists(select 1 from public.admin_uploads where storage_path=patch->>'storage_path' and state in ('pending','ready')) then raise exception 'Upload is unavailable'; end if;
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

create function public.admin_storage_claim(p_actor uuid,p_session uuid,p_upload uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare role_name text; path text; target text;
begin
  role_name:=public.admin_gate(p_actor,p_session,false);
  if role_name<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  select storage_path into path from public.admin_uploads where id=p_upload and state not in ('deleted','pending') for update;
  if path is null then raise exception 'Upload not eligible for cleanup'; end if;
  target:='https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'||path;
  if exists(select 1 from public.study_materials where storage_path=path or pdf_url=target)
    or exists(select 1 from public.announcements where storage_path=path or attachment_url=target)
    or exists(select 1 from public.short_links where url=target) then raise exception 'A surviving record or short link still references this file' using errcode='23514'; end if;
  update public.admin_uploads set state='deleting',updated_at=now() where id=p_upload;
  insert into public.admin_audit_logs(actor_id,action,record_type,record_id) values(p_actor,'storage_cleanup_requested','storage',path);
  return path;
end $$;

revoke all on all functions in schema admin_private from public,anon,authenticated;
grant execute on all functions in schema admin_private to service_role;
grant all on all tables in schema admin_private to service_role;
revoke execute on function public.admin_gate(uuid,uuid,boolean),public.admin_mutate(uuid,uuid,text,text,text,integer,jsonb),public.admin_storage_claim(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_gate(uuid,uuid,boolean),public.admin_mutate(uuid,uuid,text,text,text,integer,jsonb),public.admin_storage_claim(uuid,uuid,uuid) to service_role;
commit;
