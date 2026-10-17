-- Registration is open to verified email accounts. Role choices stay server-side;
-- existing disabled accounts stay disabled and existing owner roles are preserved.
create or replace function public.admin_gate(p_actor uuid,p_session uuid,p_write boolean default false) returns text
language plpgsql security invoker set search_path='' as $$
declare r text; n integer;
begin
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now())) then raise exception 'Session expired' using errcode='28000'; end if;
  if not exists(select 1 from auth.users where id=p_actor and email is not null and email_confirmed_at is not null) then raise exception 'Verify your email before accessing the admin panel' using errcode='42501'; end if;
  if not exists(select 1 from public.admin_users where user_id=p_actor) then
    insert into public.admin_users(user_id,role)
      select u.id,coalesce(p.role,'admin') from auth.users u left join admin_private.pending_admins p on lower(u.email)=p.email
      where u.id=p_actor on conflict(user_id) do nothing;
  end if;
  select role into r from public.admin_users where user_id=p_actor and enabled;
  if r is null then raise exception 'This account has been disabled. Contact the site owner.' using errcode='42501'; end if;
  delete from admin_private.pending_admins where email=(select lower(email) from auth.users where id=p_actor);
  if p_write then
    delete from admin_private.rate_limits where window_start<now()-interval '10 minutes';
    insert into admin_private.rate_limits values(p_actor,date_trunc('minute',now()),1)
      on conflict(actor_id,window_start) do update set hits=admin_private.rate_limits.hits+1 returning hits into n;
    if n>90 then raise exception 'Too many actions. Try again in a minute.' using errcode='54000'; end if;
  end if;
  return r;
end $$;

-- A user's retry may revive their deleted upload job at the retained URL.
create or replace function public.admin_upload_prepare(p_actor uuid,p_session uuid,p_upload uuid,p_checksum text,p_filename text,p_size bigint,p_table text,p_record text,p_url text,p_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.admin_uploads; asset public.admin_pdf_assets; reused boolean; exists_record boolean;
begin
  perform public.admin_gate(p_actor,p_session,false);
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
