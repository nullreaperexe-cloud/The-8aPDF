-- Run against the installed schema. Everything, including test delivery rows,
-- is rolled back before another session can observe it.
begin;
do $$
declare r jsonb; eligible integer; actual integer; lease uuid;
begin
 if exists(select 1 from public.school_push_events where id like '__push_regression_%') then raise exception 'Test IDs already exist'; end if;
 update public.school_push_sources set initialized=false where id='study_materials';
 r:=public.school_push_ingest('study_materials',jsonb_build_array(jsonb_build_object('id','__push_regression_baseline','source','pdf','source_id','test','title','Regression baseline','body','Test','path','/','is_test',true)));
 if not (r->>'baseline')::boolean or (r->>'queued')::int<>0 then raise exception 'Historical baseline was broadcast'; end if;
 r:=public.school_push_ingest('study_materials',jsonb_build_array(jsonb_build_object('id','__push_regression_new','source','pdf','source_id','test','title','Regression update','body','Test','path','/','is_test',true)));
 select count(*) into eligible from public.school_push_subscriptions where coalesce((preferences->>'pdfs')::boolean,true);
 if (r->>'queued')::int<>eligible then raise exception 'Subscriber fan-out mismatch'; end if;
 r:=public.school_push_ingest('study_materials',jsonb_build_array(jsonb_build_object('id','__push_regression_new','source','pdf','source_id','test','title','Regression update','body','Test','path','/','is_test',true)));
 if (r->>'new')::int<>0 or (r->>'queued')::int<>0 then raise exception 'Duplicate update was queued'; end if;
 -- A malformed row aborts the complete batch, including the valid first row.
 begin
  perform public.school_push_ingest('study_materials',jsonb_build_array(jsonb_build_object('id','__push_regression_atomic','source','pdf','source_id','test','title','Test','body','Test','path','/','is_test',true),jsonb_build_object('id','__push_regression_invalid')));
  raise exception 'Malformed input was accepted';
 exception when not_null_violation then null;
 end;
 if exists(select 1 from public.school_push_events where id='__push_regression_atomic') then raise exception 'Batch committed partially'; end if;
 -- Test owned leases without waiting for or clearing a live worker's lease.
 if not exists(select 1 from public.school_push_config where lease_until>now()) then
  lease:=public.school_push_claim_run_v2();
  if lease is null or public.school_push_claim_run_v2() is not null then raise exception 'Lease did not exclude the second worker'; end if;
 end if;
 if has_function_privilege('anon','public.school_push_ingest(text,jsonb)','execute') or has_function_privilege('authenticated','public.school_push_claim_run_v2()','execute') then raise exception 'Browser roles can invoke privileged worker RPCs'; end if;
end;
$$;
rollback;
