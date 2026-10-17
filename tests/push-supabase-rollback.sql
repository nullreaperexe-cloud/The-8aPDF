-- No test content or push request escapes this transaction.
begin;
do $$
declare r jsonb; eligible integer; device text; owner uuid; item text; source_name text; event_source text;
begin
 for source_name,event_source in values ('study_materials','pdf'),('announcements','announcement') loop
  update public.school_push_sources set initialized=true,feed_id='firestore:academyvault-5d1eb' where id=source_name;
  r:=public.school_push_ingest_v2(source_name,'supabase:xudhjwojgxblbsebkzso',jsonb_build_array(jsonb_build_object('id','__migration_baseline_'||source_name,'source',event_source,'source_id','test','title','Historical record','body','Test','path','/','is_test',true)));
  if not (r->>'baseline')::boolean or (r->>'queued')::int<>0 then raise exception 'Migration broadcast historical content'; end if;
  r:=public.school_push_ingest_v2(source_name,'supabase:xudhjwojgxblbsebkzso',jsonb_build_array(jsonb_build_object('id','__migration_new_'||source_name,'source',event_source,'source_id','test','title','New record','body','Test','path','/','is_test',true)));
  select count(*) into eligible from public.school_push_subscriptions where coalesce((preferences->>case when event_source='pdf' then 'pdfs' else 'announcements' end)::boolean,true);
  if (r->>'queued')::int<>eligible or (r->>'baseline')::boolean then raise exception 'New publication fan-out mismatch'; end if;
  r:=public.school_push_ingest_v2(source_name,'supabase:xudhjwojgxblbsebkzso',jsonb_build_array(jsonb_build_object('id','__migration_new_'||source_name,'source',event_source,'source_id','test','title','New record','body','Test','path','/','is_test',true)));
  if (r->>'new')::int<>0 or (r->>'queued')::int<>0 then raise exception 'Duplicate publication was queued'; end if;
 end loop;
 begin
  perform public.school_push_ingest_v2('study_materials','supabase:xudhjwojgxblbsebkzso',jsonb_build_array(jsonb_build_object('id','__migration_atomic','source','pdf','source_id','test','title','Test','body','Test','path','/','is_test',true),jsonb_build_object('id','__migration_invalid')));
  raise exception 'Malformed event was accepted';
 exception when not_null_violation then null;
 end;
 if exists(select 1 from public.school_push_events where id='__migration_atomic') then raise exception 'Partial ingestion committed'; end if;
 select id,user_id into device,owner from public.school_push_subscriptions limit 1;
 if device is not null then
  begin
   perform public.school_push_queue_device_test(device,gen_random_uuid());
   raise exception 'Wrong owner was accepted';
  exception when raise_exception then if sqlerrm<>'Enable notifications first' then raise; end if;
  end;
  r:=public.school_push_queue_device_test(device,owner);
  if not (r->>'queued')::boolean or (r->>'notBefore')::timestamptz<now()+interval '29 seconds' then raise exception 'Test was not delayed'; end if;
  if not exists(select 1 from public.school_push_deliveries d join public.school_push_events e on e.id=d.event_id where d.subscription_id=device and e.source='device-test' and d.next_attempt_at=(r->>'notBefore')::timestamptz) then raise exception 'Device test was not persisted'; end if;
 end if;
 if has_function_privilege('anon','public.school_push_ingest_v2(text,text,jsonb)','execute') or has_function_privilege('authenticated','public.school_push_queue_device_test(text,uuid)','execute') then raise exception 'Browser role can invoke worker RPCs'; end if;
end;
$$;
rollback;
