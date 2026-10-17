-- Run in the existing AcademyVault PUSH project, not the catalogue project.
-- Preserve all installed VAPID keys, device subscriptions and delivery history.
begin;
alter table public.school_push_sources add column if not exists feed_id text not null default 'firestore:academyvault-5d1eb';

create or replace function public.school_push_ingest_v2(source_name text, feed_name text, records jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare initialized_before boolean; added integer; queued integer;
begin
 if source_name not in ('study_materials','announcements')
    or feed_name is distinct from 'supabase:xudhjwojgxblbsebkzso'
    or jsonb_typeof(records) is distinct from 'array' then
   raise exception 'Invalid school feed';
 end if;
 insert into public.school_push_sources(id) values(source_name) on conflict do nothing;
 select initialized and feed_id=feed_name into initialized_before
 from public.school_push_sources where id=source_name for update;
 with fresh as (
   insert into public.school_push_events(id,source,source_id,title,body,path,is_test)
   select r.id,r.source,r.source_id,r.title,r.body,r.path,r.is_test
   from jsonb_to_recordset(records) as r(id text,source text,source_id text,title text,body text,path text,is_test boolean)
   on conflict(id) do nothing returning id,source,is_test,detected_at
 ), deliveries as (
   insert into public.school_push_deliveries(subscription_id,event_id)
   select s.id,e.id from fresh e cross join public.school_push_subscriptions s
   where initialized_before and s.created_at<=e.detected_at
     and case when e.source='pdf' then coalesce((s.preferences->>'pdfs')::boolean,true)
              else coalesce((s.preferences->>'announcements')::boolean,true) end
     and (not coalesce((s.preferences->>'testsOnly')::boolean,false) or e.is_test)
   on conflict do nothing returning event_id
 ) select (select count(*) from fresh),(select count(*) from deliveries) into added,queued;
 update public.school_push_sources set initialized=true,feed_id=feed_name,last_checked_at=now() where id=source_name;
 return jsonb_build_object('records',jsonb_array_length(records),'new',added,'queued',queued,'baseline',not initialized_before);
end;
$$;

-- A device-only test is persisted before returning. Cron sends it after the
-- tab is closed; no page timer or open browser connection is involved.
create or replace function public.school_push_queue_device_test(device_id text, owner_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare event_key text := 'device-test:' || gen_random_uuid()::text;
        due_at timestamptz := now()+interval '30 seconds';
begin
 perform 1 from public.school_push_subscriptions where id=device_id and user_id=owner_id for key share;
 if not found then raise exception 'Enable notifications first'; end if;
 insert into public.school_push_events(id,source,source_id,title,body,path,is_test)
 values(event_key,'device-test',device_id,'8aPDF background test',
   'This notification was sent by the server while your website could be closed.','/notification-settings',false);
 insert into public.school_push_deliveries(subscription_id,event_id,next_attempt_at)
 values(device_id,event_key,due_at);
 return jsonb_build_object('queued',true,'notBefore',due_at,'withinSeconds',90);
end;
$$;
revoke all on function public.school_push_ingest_v2(text,text,jsonb),public.school_push_queue_device_test(text,uuid) from public,anon,authenticated;
grant execute on function public.school_push_ingest_v2(text,text,jsonb),public.school_push_queue_device_test(text,uuid) to service_role;
commit;
