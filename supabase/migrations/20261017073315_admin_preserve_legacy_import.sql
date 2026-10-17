-- Only a trusted service-role REST importer may preserve a historical alias
-- whose original record has not been migrated. Browser roles have no writes.
create or replace function admin_private.guard_link() returns trigger language plpgsql set search_path='' as $$
declare legacy_import boolean := coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-apdf-legacy-import','false')='true'
  and nullif(current_setting('apdf.actor',true),'') is null;
begin
  perform pg_advisory_xact_lock(hashtext('8apdf-links'));
  if TG_OP<>'DELETE' and new.document_id is not null and not legacy_import then
    if not exists(select 1 from public.study_materials where id=new.document_id and split_part(pdf_url,'#',1)=split_part(new.url,'#',1) and published=true and archived_at is null) then
      raise exception 'Short links require a matching published library record' using errcode='23514';
    end if;
  end if;
  return coalesce(new,old);
end $$;
