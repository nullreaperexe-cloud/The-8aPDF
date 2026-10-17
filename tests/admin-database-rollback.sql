-- Run through the project-owner SQL connection only after isolated test users
-- are provisioned. All rows, roles, rate-limit counters and audit events rollback.
begin;
set local role service_role;
do $$
declare actor uuid; sid uuid; rec jsonb; clone jsonb; result jsonb; test_id text:='admin-rollback-'||gen_random_uuid(); copy_id text:='admin-rollback-'||gen_random_uuid();
  original_created text; alias text:='rollback-'||substr(gen_random_uuid()::text,1,8); original_url text:='https://example.invalid/'||gen_random_uuid()||'.pdf'; blocked boolean;
  target text; direct_id text; direct_row jsonb;
begin
  select u.id,s.id into actor,sid from auth.users u join auth.sessions s on s.user_id=u.id
    where u.email like '8apdf-integration-super_admin-%@example.invalid' and (s.not_after is null or s.not_after>now()) limit 1;
  if actor is null then raise exception 'Provision the isolated test identity and sign in before this test'; end if;
  if public.admin_gate(actor,sid,false)<>'super_admin' then raise exception 'Role verification failed'; end if;
  blocked:=false;
  begin perform public.admin_gate(actor,gen_random_uuid(),false); exception when sqlstate '28000' then blocked:=true; end;
  if not blocked then raise exception 'Missing session was accepted'; end if;

  rec:=public.admin_mutate(actor,sid,'study_materials','create',test_id,null,jsonb_build_object('title','Original rollback title','subject','Science','pdf_url',original_url,'source_date','2026-10-17T00:00:00Z','published',false));
  original_created:=rec->>'created_at';
  perform set_config('apdf.actor','',true);
  update public.study_materials set raw='{"originalLegacyField":"preserved"}' where id=test_id;
  update public.study_materials set title='Automation overwrite attempt',raw='{}',published=true,created_at='2000-01-01' where id=test_id;
  select to_jsonb(t) into rec from public.study_materials t where id=test_id;
  if rec->>'title'<>'Original rollback title' or rec->>'published'<>'false' or rec->>'created_at'<>original_created or rec->'raw'->>'originalLegacyField'<>'preserved' then raise exception 'Sync overwrote preserved admin or legacy metadata'; end if;

  rec:=public.admin_mutate(actor,sid,'study_materials','archive',test_id,(rec->>'version')::integer);
  result:=public.admin_mutate(actor,sid,'study_materials','archive',test_id,(rec->>'version')::integer);
  if result->>'version'<>rec->>'version' then raise exception 'Repeated archive was not idempotent'; end if;
  update public.admin_users set role='admin' where user_id=actor;
  blocked:=false;
  begin perform public.admin_mutate(actor,sid,'study_materials','delete',test_id,(rec->>'version')::integer); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Regular admin permanently deleted a record'; end if;
  update public.admin_users set role='super_admin' where user_id=actor;
  rec:=public.admin_mutate(actor,sid,'study_materials','restore',test_id,(rec->>'version')::integer);
  if rec->>'published'<>'false' then raise exception 'Restore did not recover the original draft status'; end if;
  result:=public.admin_mutate(actor,sid,'study_materials','restore',test_id,(rec->>'version')::integer);
  if result->>'version'<>rec->>'version' then raise exception 'Restore of an active record changed it'; end if;

  rec:=public.admin_mutate(actor,sid,'study_materials','edit',test_id,(rec->>'version')::integer,'{"published":true}');
  clone:=public.admin_mutate(actor,sid,'study_materials','create',copy_id,null,jsonb_build_object('title','Retained reference','pdf_url',original_url||'#8apdf-copy=rollback','published',true));
  perform public.admin_mutate(actor,sid,'short_links','create',alias,null,jsonb_build_object('document_id',test_id,'url',original_url,'title','Rollback link'));
  result:=public.admin_mutate(actor,sid,'short_links','transfer',alias,null,jsonb_build_object('document_id',copy_id,'url',clone->>'pdf_url'));
  if result->>'url'<>original_url or result->>'document_id'<>copy_id then raise exception 'Transfer changed the permanent destination'; end if;
  rec:=public.admin_mutate(actor,sid,'study_materials','archive',test_id,(rec->>'version')::integer);
  perform public.admin_mutate(actor,sid,'study_materials','delete',test_id,(rec->>'version')::integer);
  if not exists(select 1 from public.short_links where slug=alias and document_id=copy_id and url=original_url) then raise exception 'Shared link was lost during duplicate cleanup'; end if;

  -- A linked PDF remains protected even when it has not been archived.
  blocked:=false;
  begin perform public.admin_mutate(actor,sid,'study_materials','delete',copy_id,(clone->>'version')::integer); exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'A linked active PDF was deleted'; end if;

  foreach target in array array['study_materials','announcements'] loop
    direct_id:='admin-direct-delete-'||gen_random_uuid();
    direct_row:=public.admin_mutate(actor,sid,target,'create',direct_id,null,
      case when target='study_materials' then jsonb_build_object('title','Direct delete rollback','pdf_url','https://example.invalid/'||gen_random_uuid()||'.pdf','published',true)
      else jsonb_build_object('title','Direct delete rollback','original_message','Retain this message in the recovery snapshot','published',true) end);
    if direct_row->>'archived_at' is not null then raise exception 'Direct deletion fixture was archived'; end if;
    update public.admin_users set role='admin' where user_id=actor;
    blocked:=false;
    begin perform public.admin_mutate(actor,sid,target,'delete',direct_id,(direct_row->>'version')::integer); exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'Regular admin deleted active %',target; end if;
    update public.admin_users set role='super_admin' where user_id=actor;
    blocked:=false;
    begin perform public.admin_mutate(actor,sid,target,'delete',direct_id,0); exception when sqlstate 'PT409' then blocked:=true; end;
    if not blocked then raise exception 'Stale version deleted active %',target; end if;
    result:=public.admin_mutate(actor,sid,target,'delete',direct_id,(direct_row->>'version')::integer);
    if result->>'deleted'<>'true' then raise exception 'Direct deletion failed for %',target; end if;
    if not exists(select 1 from public.admin_deleted_records where record_id=direct_id and record_type=target and data->>'title'='Direct delete rollback' and data->>'published'='true') then raise exception 'Recovery snapshot missing for %',target; end if;
    if not exists(select 1 from public.admin_audit_logs where record_id=direct_id and record_type=target and action='deleted' and before_data->>'title'='Direct delete rollback') then raise exception 'Deletion audit missing for %',target; end if;
  end loop;

  insert into admin_private.rate_limits values(actor,date_trunc('minute',now()),90) on conflict(actor_id,window_start) do update set hits=90;
  blocked:=false;
  begin perform public.admin_gate(actor,sid,true); exception when sqlstate '54000' then blocked:=true; end;
  if not blocked then raise exception 'Rate limit was bypassed'; end if;
end $$;
rollback;
select 'PASS: role, session revocation, sync preservation, timestamps, draft restore, repeated actions, direct active PDF/announcement deletion, recovery snapshots, audits, stale-version rejection, protected links, destination-preserving link transfer, and rate limits. All fixture changes rolled back.' result;
