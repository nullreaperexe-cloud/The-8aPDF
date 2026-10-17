-- Catalogue records, short aliases and hosted files have independent lifecycles.
create or replace function admin_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare actor text := nullif(current_setting('apdf.actor',true),''); oldj jsonb; newj jsonb; k text;
begin
  if TG_OP='INSERT' then new.inserted_at:=now(); return new; end if;
  if TG_OP='DELETE' then
    if TG_TABLE_NAME='study_materials' then
      perform pg_advisory_xact_lock(hashtext('8apdf-links'));
      -- Keep the alias, its owner and its exact destination after record removal.
      update public.short_links set document_id=null where document_id=old.id;
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
    if exists(select 1 from public.short_links where document_id=old.id or (document_id is null and url=oldj->>'pdf_url')) then raise exception 'A shared short link protects this saved PDF URL' using errcode='23514'; end if;
  end if;
  new.created_at:=old.created_at;
  new.raw:=coalesce(new.raw,'{}'::jsonb)||old.raw;
  new.inserted_at:=old.inserted_at;
  new.version:=old.version+1; new.updated_at:=now();
  return new;
end $$;

-- Decode only URLs belonging to this project's public PDF bucket. This also
-- recognizes escaped filenames, query strings and page fragments in references.
create function admin_private.pdf_file_path(value text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare prefix constant text:='https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'; tail text; bytes bytea:=''::bytea; pos integer:=1;
begin
  if value is null or left(value,length(prefix))<>prefix then return null; end if;
  tail:=split_part(split_part(substr(value,length(prefix)+1),'#',1),'?',1);
  while pos<=length(tail) loop
    if substr(tail,pos,1)='%' and substr(tail,pos+1,2) ~ '^[0-9a-fA-F]{2}$' then
      bytes:=bytes||decode(substr(tail,pos+1,2),'hex');pos:=pos+3;
    else bytes:=bytes||convert_to(substr(tail,pos,1),'UTF8');pos:=pos+1; end if;
  end loop;
  return convert_from(bytes,'UTF8');
exception when others then return null;
end $$;
revoke all on function admin_private.pdf_file_path(text) from public,anon,authenticated;
grant execute on function admin_private.pdf_file_path(text) to service_role;

create index admin_pdf_file_url_path on public.study_materials(admin_private.pdf_file_path(pdf_url));
create index admin_announcement_file_url_path on public.announcements(admin_private.pdf_file_path(attachment_url));
create index admin_short_link_file_url_path on public.short_links(admin_private.pdf_file_path(url));

-- Read the actual bucket inventory, including files whose catalogue record was
-- deleted and files without a tracked admin upload job. No Storage rows are edited.
create view public.admin_file_links with (security_invoker=true) as
select o.id::text as id,o.name as storage_path,coalesce(u.filename,o.name) as filename,
  o.created_at,coalesce((o.metadata->>'size')::bigint,u.size_bytes,0) as size_bytes,
  (select count(*) from public.study_materials m where m.storage_path=o.name or admin_private.pdf_file_path(m.pdf_url)=o.name)
   +(select count(*) from public.announcements a where a.storage_path=o.name or admin_private.pdf_file_path(a.attachment_url)=o.name) as record_references,
  (select count(*) from public.short_links l where admin_private.pdf_file_path(l.url)=o.name) as short_link_references
from storage.objects o left join public.admin_uploads u on u.storage_path=o.name
where o.bucket_id='study-pdfs';
revoke all on public.admin_file_links from public,anon,authenticated;
grant select on public.admin_file_links to service_role;

create function public.admin_file_claim(p_actor uuid,p_session uuid,p_path text) returns text
language plpgsql security invoker set search_path='' as $$
declare role_name text;
begin
  role_name:=public.admin_gate(p_actor,p_session,false);
  if role_name<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
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
revoke all on function public.admin_file_claim(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_file_claim(uuid,uuid,text) to service_role;

create or replace function public.admin_storage_claim(p_actor uuid,p_session uuid,p_upload uuid) returns text
language plpgsql security invoker set search_path='' as $$
declare path text;
begin
  perform public.admin_gate(p_actor,p_session,false);
  select storage_path into path from public.admin_uploads where id=p_upload and state not in ('deleted','pending');
  if path is null then raise exception 'Upload not eligible for cleanup'; end if;
  return public.admin_file_claim(p_actor,p_session,path);
end $$;
