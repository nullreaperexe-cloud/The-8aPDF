create or replace function admin_private.guard_record() returns trigger language plpgsql set search_path='' as $$
declare actor text := nullif(current_setting('apdf.actor',true),''); oldj jsonb; newj jsonb; k text;
begin
  if TG_OP='INSERT' then new.inserted_at:=now(); return new; end if;
  if TG_OP='DELETE' then
    if TG_TABLE_NAME='study_materials' then
      perform pg_advisory_xact_lock(hashtext('8apdf-links'));
      if exists(select 1 from public.short_links where document_id=old.id or (document_id is null and url=old.pdf_url)) then raise exception 'Active short links must be reviewed before deleting this PDF' using errcode='23514'; end if;
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
create or replace function admin_private.guard_link() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  if TG_OP<>'DELETE' and new.document_id is not null then
    if not exists(select 1 from public.study_materials where id=new.document_id and split_part(pdf_url,'#',1)=split_part(new.url,'#',1) and published=true and archived_at is null) then
      raise exception 'Short links require a matching published library record' using errcode='23514';
    end if;
  end if;
  return coalesce(new,old);
end $$;
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
    if prior->>'archived_at' is null then raise exception 'Archive the record before permanent deletion' using errcode='23514'; end if;
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