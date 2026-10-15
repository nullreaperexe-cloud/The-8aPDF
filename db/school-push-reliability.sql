-- Additive upgrade; preserve the installed VAPID keys, subscribers and history.
begin;
alter table public.school_push_config add column if not exists lease_owner uuid;
alter table public.school_push_deliveries add column if not exists last_error text;

-- A unique owner prevents an old invocation from releasing a newer lease.
create or replace function public.school_push_claim_run_v2() returns uuid
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid := gen_random_uuid();
begin
 update public.school_push_config set lease_until=now()+interval '100 seconds', lease_owner=owner_id
 where id=1 and (lease_until is null or lease_until<now());
 if found then return owner_id; end if;
 return null;
end;
$$;

-- Event insertion and fan-out are ONE transaction. A failed delivery insert
-- rolls back the event too, so the next poll can retry it without losing alerts.
create or replace function public.school_push_ingest(source_name text, records jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare initialized_before boolean; added integer; queued integer;
begin
 if source_name not in ('study_materials','announcements') or jsonb_typeof(records)<>'array' then
   raise exception 'Invalid school feed';
 end if;
 insert into public.school_push_sources(id) values(source_name) on conflict do nothing;
 select initialized into initialized_before from public.school_push_sources where id=source_name for update;
 with fresh as (
   insert into public.school_push_events(id,source,source_id,title,body,path,is_test)
   select r.id,r.source,r.source_id,r.title,r.body,r.path,r.is_test
   from jsonb_to_recordset(records) as r(id text,source text,source_id text,title text,body text,path text,is_test boolean)
   on conflict(id) do nothing returning id,source,is_test,detected_at
 ), deliveries as (
   insert into public.school_push_deliveries(subscription_id,event_id)
   select s.id,e.id from fresh e cross join public.school_push_subscriptions s
   where initialized_before
     and s.created_at<=e.detected_at
     and case when e.source='pdf' then coalesce((s.preferences->>'pdfs')::boolean,true)
              else coalesce((s.preferences->>'announcements')::boolean,true) end
     and (not coalesce((s.preferences->>'testsOnly')::boolean,false) or e.is_test)
   on conflict do nothing returning event_id
 ) select (select count(*) from fresh),(select count(*) from deliveries) into added,queued;
 update public.school_push_sources set initialized=true,last_checked_at=now() where id=source_name;
 return jsonb_build_object('records',jsonb_array_length(records),'new',added,'queued',queued,'baseline',not initialized_before);
end;
$$;
revoke all on function public.school_push_claim_run_v2() from public,anon,authenticated;
revoke all on function public.school_push_ingest(text,jsonb) from public,anon,authenticated;
grant execute on function public.school_push_claim_run_v2(), public.school_push_ingest(text,jsonb) to service_role;
commit;
