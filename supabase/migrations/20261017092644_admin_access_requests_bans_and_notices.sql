-- Persistent identity protection, access requests and notices. All access stays
-- behind the authenticated Edge API; browser roles cannot call these RPCs.
create table admin_private.workspace_owner (
  singleton boolean primary key default true check(singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict
);
insert into admin_private.workspace_owner(user_id) select id from auth.users where lower(email)='nullreaper.exe@gmail.com';
alter table admin_private.workspace_owner enable row level security;
do $$ begin if not exists(select 1 from admin_private.workspace_owner) then raise exception 'The verified site owner must exist before access management is configured'; end if; end $$;
revoke all on admin_private.workspace_owner from public,anon,authenticated;
grant select on admin_private.workspace_owner to service_role;
create function admin_private.is_owner(p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from admin_private.workspace_owner where user_id=p_user)
$$;
revoke all on function admin_private.is_owner(uuid) from public,anon,authenticated;
grant execute on function admin_private.is_owner(uuid) to service_role;

create table public.admin_access_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected','banned')),
 requested_at timestamptz not null default now(), decided_at timestamptz, decided_by uuid
);
create index admin_requests_pending on public.admin_access_requests(requested_at) where status='pending';
create table public.admin_access_notices (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('viewer_welcome','super_admin_granted','banned','unbanned','request_rejected','access_changed')),
 created_at timestamptz not null default now(), read_at timestamptz
);
create unique index admin_viewer_welcome_once on public.admin_access_notices(user_id) where kind='viewer_welcome';
create index admin_unread_notices on public.admin_access_notices(user_id,id) where read_at is null;
alter table public.admin_access_requests enable row level security;
alter table public.admin_access_notices enable row level security;
revoke all on public.admin_access_requests,public.admin_access_notices from public,anon,authenticated;
grant all on public.admin_access_requests,public.admin_access_notices to service_role;
grant usage,select on sequence public.admin_access_notices_id_seq to service_role;

create function admin_private.protect_owner_and_notify() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then
   if admin_private.is_owner(old.user_id) then raise exception 'The site owner cannot be banned or removed' using errcode='42501'; end if;
   return old;
 end if;
 if admin_private.is_owner(new.user_id) and (not new.enabled or new.role<>'super_admin') then raise exception 'The site owner cannot be banned or downgraded' using errcode='42501'; end if;
 if TG_OP='INSERT' then
   if new.role='viewer' then insert into public.admin_access_notices(user_id,kind) values(new.user_id,'viewer_welcome') on conflict do nothing;
   elsif new.role='super_admin' and new.enabled then insert into public.admin_access_notices(user_id,kind) values(new.user_id,'super_admin_granted'); end if;
 elsif new.enabled is distinct from old.enabled then
   insert into public.admin_access_notices(user_id,kind) values(new.user_id,case when new.enabled then 'unbanned' else 'banned' end);
 elsif new.enabled and new.role is distinct from old.role then
   insert into public.admin_access_notices(user_id,kind) values(new.user_id,case when new.role='super_admin' then 'super_admin_granted' else 'access_changed' end);
 end if;
 return new;
end $$;
revoke all on function admin_private.protect_owner_and_notify() from public,anon,authenticated;
grant execute on function admin_private.protect_owner_and_notify() to service_role;
create trigger admin_owner_and_notices before insert or update or delete on public.admin_users
 for each row execute function admin_private.protect_owner_and_notify();
insert into public.admin_access_notices(user_id,kind) select user_id,'viewer_welcome' from public.admin_users where role='viewer' on conflict do nothing;

-- A banned account may authenticate only to see its ban notice and sign out.
create function public.admin_session_identity(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and (not_after is null or not_after>now())) then raise exception 'Session expired' using errcode='28000'; end if;
 if not exists(select 1 from auth.users where id=p_actor and email is not null and email_confirmed_at is not null) then raise exception 'Verify your email before signing in' using errcode='42501'; end if;
end $$;
create function public.admin_access_status(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare member public.admin_users;
begin
 perform public.admin_session_identity(p_actor,p_session);
 select * into member from public.admin_users where user_id=p_actor;
 if not found then perform public.admin_gate(p_actor,p_session,false); select * into member from public.admin_users where user_id=p_actor; end if;
 return jsonb_build_object('userId',p_actor,'role',member.role,'banned',not member.enabled,'owner',admin_private.is_owner(p_actor),
 'request',(select to_jsonb(r)-'decided_by' from public.admin_access_requests r where user_id=p_actor),
 'notices',coalesce((select jsonb_agg(n order by n.id) from (
   select id,kind,created_at from public.admin_access_notices n where n.user_id=p_actor and read_at is null and (
    (not member.enabled and kind='banned') or (member.enabled and (
      (kind='viewer_welcome' and member.role='viewer') or (kind='super_admin_granted' and member.role='super_admin') or kind in ('unbanned','access_changed')
      or (kind='request_rejected' and member.role='viewer' and exists(select 1 from public.admin_access_requests where user_id=p_actor and status='rejected'))
    ))) order by id limit 30
 ) n),'[]'::jsonb),
 'pendingRequests',case when member.enabled and member.role='super_admin' then coalesce((select jsonb_agg(r order by r.requested_at) from (
   select r.user_id,u.email,r.requested_at from public.admin_access_requests r join auth.users u on u.id=r.user_id join public.admin_users a on a.user_id=r.user_id
   where r.status='pending' and a.enabled and a.role='viewer' order by r.requested_at limit 100
 ) r),'[]'::jsonb) else '[]'::jsonb end);
end $$;
create function public.admin_notice_ack(p_actor uuid,p_session uuid,p_ids bigint[]) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform public.admin_session_identity(p_actor,p_session);
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Too many notices' using errcode='23514'; end if;
 update public.admin_access_notices set read_at=coalesce(read_at,now()) where user_id=p_actor and id=any(p_ids);
end $$;
create function public.admin_request_access(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare prior public.admin_access_requests; result public.admin_access_requests;
begin
 if public.admin_gate(p_actor,p_session,false)<>'viewer' then raise exception 'This account already has administrator access' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('8apdf-request-'||p_actor));
 select * into prior from public.admin_access_requests where user_id=p_actor;
 if found and prior.status='pending' then return to_jsonb(prior)-'decided_by'; end if;
 if prior.requested_at>now()-interval '1 minute' then raise exception 'Please wait a minute before requesting access again' using errcode='54000'; end if;
 insert into public.admin_access_requests(user_id) values(p_actor)
 on conflict(user_id) do update set status='pending',requested_at=now(),decided_at=null,decided_by=null returning * into result;
 insert into public.admin_audit_logs(actor_id,action,record_type,record_id) values(p_actor,'access_requested','admin_users',p_actor::text);
 return to_jsonb(result)-'decided_by';
end $$;

create or replace function public.admin_access_set(p_actor uuid,p_session uuid,p_email text,p_role text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare email_value text:=lower(trim(p_email)); target_id uuid;
begin
 if public.admin_gate(p_actor,p_session,true)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('viewer','super_admin') or email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Choose a valid email and role' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('8apdf-access'));
 select id into target_id from auth.users where lower(email)=email_value;
 if target_id is null then
   if p_role='super_admin' then insert into admin_private.pending_admins(email,role) values(email_value,p_role) on conflict(email) do update set role=excluded.role;
   else delete from admin_private.pending_admins where email=email_value; end if;
 else
   if admin_private.is_owner(target_id) and p_role<>'super_admin' then raise exception 'The site owner keeps Super Admin access' using errcode='42501'; end if;
   if exists(select 1 from public.admin_users where user_id=target_id and not enabled) then raise exception 'Unban this account before changing its access' using errcode='23514'; end if;
   insert into public.admin_users(user_id,role,enabled) values(target_id,p_role,true) on conflict(user_id) do update set role=excluded.role;
   delete from admin_private.pending_admins where email=email_value;
   if p_role='super_admin' then update public.admin_access_requests set status='approved',decided_at=now(),decided_by=p_actor where user_id=target_id and status='pending'; end if;
 end if;
 insert into public.admin_audit_logs(actor_id,action,record_type,record_id,after_data) values(p_actor,'access_changed','admin_users',email_value,jsonb_build_object('role',p_role,'pending',target_id is null));
 return jsonb_build_object('email',email_value,'role',p_role,'pending',target_id is null);
end $$;
create function public.admin_account_ban(p_actor uuid,p_session uuid,p_email text,p_banned boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target_id uuid; email_value text:=lower(trim(p_email)); current_role text;
begin
 if public.admin_gate(p_actor,p_session,true)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 if p_banned is null then raise exception 'Choose ban or unban' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('8apdf-access'));
 select id into target_id from auth.users where lower(email)=email_value;
 if target_id is null then raise exception 'No registered account has this email' using errcode='P0002'; end if;
 if admin_private.is_owner(target_id) then raise exception 'The site owner cannot be banned' using errcode='42501'; end if;
 insert into public.admin_users(user_id,role,enabled) values(target_id,'viewer',true) on conflict do nothing;
 update public.admin_users set enabled=not p_banned where user_id=target_id returning role into current_role;
 update public.admin_access_requests set status=case when p_banned then 'banned' else 'rejected' end,decided_at=now(),decided_by=p_actor where user_id=target_id and (status='pending' or (not p_banned and status='banned'));
 insert into public.admin_audit_logs(actor_id,action,record_type,record_id,after_data) values(p_actor,case when p_banned then 'account_banned' else 'account_unbanned' end,'admin_users',email_value,jsonb_build_object('role',current_role,'banned',p_banned));
 return jsonb_build_object('email',email_value,'role',current_role,'banned',p_banned);
end $$;
create function public.admin_access_review(p_actor uuid,p_session uuid,p_user uuid,p_decision text,p_email text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare email_value text;
begin
 if public.admin_gate(p_actor,p_session,true)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approve','reject','ban') then raise exception 'Choose approve, reject or ban' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtext('8apdf-access'));
 if not exists(select 1 from public.admin_access_requests where user_id=p_user and status='pending') then raise exception 'This request has already been handled. Refresh the list.' using errcode='PT409'; end if;
 select email into email_value from auth.users where id=p_user;
 if lower(email_value) is distinct from lower(trim(p_email)) then raise exception 'Request account changed. Refresh before reviewing.' using errcode='PT409'; end if;
 if p_decision='approve' then perform public.admin_access_set(p_actor,p_session,email_value,'super_admin');
 elsif p_decision='ban' then perform public.admin_account_ban(p_actor,p_session,email_value,true);
 else
   update public.admin_access_requests set status='rejected',decided_at=now(),decided_by=p_actor where user_id=p_user;
   insert into public.admin_access_notices(user_id,kind) values(p_user,'request_rejected');
   insert into public.admin_audit_logs(actor_id,action,record_type,record_id) values(p_actor,'access_request_rejected','admin_users',p_user::text);
 end if;
 return jsonb_build_object('email',email_value,'decision',p_decision);
end $$;

create or replace function public.admin_access_list(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if public.admin_gate(p_actor,p_session,false)<>'super_admin' then raise exception 'Super Admin required' using errcode='42501'; end if;
 return jsonb_build_object('records',coalesce((select jsonb_agg(r order by r.email) from (
   select u.email,a.role,a.enabled,false as pending,admin_private.is_owner(u.id) as owner
   from public.admin_users a join auth.users u on u.id=a.user_id
   union all select p.email,p.role,true,true,false from admin_private.pending_admins p
   where not exists(select 1 from auth.users u join public.admin_users a on a.user_id=u.id where lower(u.email)=p.email)
 ) r),'[]'::jsonb),'requests',(public.admin_access_status(p_actor,p_session))->'pendingRequests');
end $$;
revoke all on function public.admin_session_identity(uuid,uuid),public.admin_access_status(uuid,uuid),public.admin_notice_ack(uuid,uuid,bigint[]),public.admin_request_access(uuid,uuid),public.admin_account_ban(uuid,uuid,text,boolean),public.admin_access_review(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_session_identity(uuid,uuid),public.admin_access_status(uuid,uuid),public.admin_notice_ack(uuid,uuid,bigint[]),public.admin_request_access(uuid,uuid),public.admin_account_ban(uuid,uuid,text,boolean),public.admin_access_review(uuid,uuid,uuid,text,text) to service_role;
