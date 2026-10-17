-- Explicit file removal is independent of catalogue and alias deletion. The
-- existing unreferenced-cleanup RPC remains conservative for older callers.
create function public.admin_file_remove_claim(p_actor uuid,p_session uuid,p_path text,p_upload uuid,p_allow_referenced boolean) returns text
language plpgsql security invoker set search_path='' as $$
declare path text:=p_path; role_name text; affected jsonb;
begin
  role_name:=public.admin_gate(p_actor,p_session,false);
  if role_name<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  if path is null then
    select storage_path into path from public.admin_uploads where id=p_upload and state in ('ready','failed','deleting');
    if path is null then raise exception 'Choose an available hosted PDF file' using errcode='P0002'; end if;
  end if;
  if p_allow_referenced is distinct from true then
    return public.admin_file_claim(p_actor,p_session,path);
  end if;
  if exists(select 1 from public.admin_uploads where storage_path=path and state='pending') then
    raise exception 'An upload is using this file. Retry deletion after it finishes.' using errcode='PT409';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='study-pdfs' and name=path)
    and not exists(select 1 from public.admin_uploads where storage_path=path and state in ('ready','failed','deleting')) then
    raise exception 'Hosted PDF file no longer exists' using errcode='P0002';
  end if;
  select jsonb_build_object(
    'pdf_ids',coalesce((select jsonb_agg(id) from public.study_materials where storage_path=path or admin_private.pdf_file_path(pdf_url)=path),'[]'::jsonb),
    'announcement_ids',coalesce((select jsonb_agg(id) from public.announcements where storage_path=path or admin_private.pdf_file_path(attachment_url)=path),'[]'::jsonb),
    'short_slugs',coalesce((select jsonb_agg(slug) from public.short_links where admin_private.pdf_file_path(url)=path),'[]'::jsonb)
  ) into affected;
  -- Keep records, short aliases, ownership and content identity intact. Only the
  -- Storage API removes the object. Re-uploading identical bytes restores its URL.
  update public.admin_uploads set state='deleting',updated_at=now() where storage_path=path;
  insert into public.admin_audit_logs(actor_id,action,record_type,record_id,before_data)
    values(p_actor,'storage_deletion_confirmed','storage',path,affected);
  return path;
end $$;
revoke all on function public.admin_file_remove_claim(uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_file_remove_claim(uuid,uuid,text,uuid,boolean) to service_role;
