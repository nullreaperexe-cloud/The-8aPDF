begin;
set local role service_role;
do $$
declare actor uuid; sid uuid; first_id uuid:=gen_random_uuid(); next_id uuid:=gen_random_uuid(); external_id uuid:=gen_random_uuid(); hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  first_path text; first_url text; reserved jsonb; doc jsonb; reused jsonb; alias text:='asset-'||substr(gen_random_uuid()::text,1,10); other_alias text:='other-'||substr(gen_random_uuid()::text,1,10);
begin
  select u.id,s.id into actor,sid from auth.users u join auth.sessions s on s.user_id=u.id where u.email like '8apdf-integration-super_admin-%@example.invalid' limit 1;
  if actor is null then raise exception 'Provision and sign in an isolated test identity'; end if;
  first_path:=actor||'/'||first_id||'.pdf';first_url:='https://xudhjwojgxblbsebkzso.supabase.co/storage/v1/object/public/study-pdfs/'||first_path;
  reserved:=public.admin_upload_prepare(actor,sid,first_id,hash,'first.pdf',100,'study_materials',first_id::text,first_url,first_path);
  doc:=public.admin_mutate(actor,sid,'study_materials','create',first_id::text,null,jsonb_build_object('title','Asset rollback','pdf_url',first_url,'storage_path',first_path,'file_checksum',hash,'published',true));
  perform public.admin_upload_links(actor,sid,first_id::text,alias);
  update public.short_links set owner_hash=repeat('b',64) where slug=alias;
  update public.admin_uploads set state='ready' where id=first_id;
  perform public.admin_mutate(actor,sid,'study_materials','delete',first_id::text,(doc->>'version')::integer);
  reserved:=public.admin_upload_prepare(actor,sid,next_id,hash,'renamed.pdf',100,'study_materials',next_id::text,'https://example.invalid/new.pdf',actor||'/'||next_id||'.pdf');
  if reserved->'asset'->>'pdf_url'<>first_url or reserved->'job'->>'storage_path'<>first_path or reserved->>'reused'<>'true' then raise exception 'Re-upload did not reuse original file identity'; end if;
  if (select count(*) from public.admin_uploads where storage_path=first_path)<>2 then raise exception 'Independent request recovery jobs not retained'; end if;
  doc:=public.admin_mutate(actor,sid,'study_materials','create',next_id::text,null,jsonb_build_object('title','Restored asset','pdf_url',first_url,'storage_path',first_path,'file_checksum',hash,'published',true));
  reused:=public.admin_upload_links(actor,sid,next_id::text,other_alias);
  if reused->'shortLink'->>'slug'<>alias or reused->>'reused'<>'true' or exists(select 1 from public.short_links where slug=other_alias) then raise exception 'Re-upload created an additional alias'; end if;
  if not exists(select 1 from public.short_links where slug=alias and document_id=next_id::text and owner_hash=repeat('b',64) and url=first_url) then raise exception 'Alias ownership or exact destination was lost'; end if;
  hash:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
  reserved:=public.admin_upload_prepare(actor,sid,external_id,hash,'remote.pdf',100,'study_materials',external_id::text,'https://www.image2url.com/remote.pdf',null);
  doc:=public.admin_mutate(actor,sid,'study_materials','create',external_id::text,null,jsonb_build_object('title','External rollback','pdf_url','https://www.image2url.com/remote.pdf','storage_path',null,'file_checksum',hash,'published',false));
  if doc->>'storage_path' is not null then raise exception 'External PDFs should not create a hosted object'; end if;
end $$;
rollback;
select 'PASS: canonical file reuse, stable storage URL, renamed files, retry reservations, old alias reuse with ownership preserved, and external PDFs without storage objects. All test changes rolled back.' as result;
