-- A one-time repair of historical reads, followed by one atomic unread query.
create table public.chat_read_state (user_id uuid primary key references auth.users(id) on delete cascade,initialized_at timestamptz not null default now());
alter table public.chat_read_state enable row level security;
create policy "Read own read state" on public.chat_read_state for select to authenticated using ((select auth.uid())=user_id);
create policy "Initialize own read state" on public.chat_read_state for insert to authenticated with check ((select auth.uid())=user_id);
revoke all on public.chat_read_state from anon,authenticated;
grant select,insert on public.chat_read_state to authenticated;
create or replace function public.chat_bootstrap_read_state() returns void language sql security invoker set search_path='' as $$
 with first_init as (insert into public.chat_read_state(user_id) values(auth.uid()) on conflict do nothing returning user_id)
 insert into public.chat_read_cursors(room_id,user_id,last_read_at)
 select m.room_id,m.user_id,greatest(m.joined_at,least('2026-10-13T14:53:07Z'::timestamptz,now())) from public.chat_members m
 where m.user_id=auth.uid() and exists(select 1 from first_init)
 on conflict(room_id,user_id) do update set last_read_at=greatest(chat_read_cursors.last_read_at,excluded.last_read_at);
$$;
create or replace function public.chat_unread_counts() returns table(room_id uuid,room_slug text,unread_count bigint,last_read_at timestamptz) language sql stable security invoker set search_path='' as $$
 select m.room_id,r.slug,count(msg.id),coalesce(c.last_read_at,m.joined_at)
 from public.chat_members m join public.chat_rooms r on r.id=m.room_id
 left join public.chat_read_cursors c on c.room_id=m.room_id and c.user_id=m.user_id
 left join public.chat_messages msg on msg.room_id=m.room_id and msg.sender_id<>auth.uid() and msg.created_at>coalesce(c.last_read_at,m.joined_at)
 where m.user_id=auth.uid() group by m.room_id,r.slug,c.last_read_at,m.joined_at;
$$;
create or replace function public.chat_mark_all_read() returns void language sql security invoker set search_path='' as $$
 insert into public.chat_read_cursors(room_id,user_id,last_read_at)
 select room_id,user_id,now() from public.chat_members where user_id=auth.uid()
 on conflict(room_id,user_id) do update set last_read_at=greatest(chat_read_cursors.last_read_at,excluded.last_read_at);
$$;
revoke all on function public.chat_bootstrap_read_state(),public.chat_unread_counts(),public.chat_mark_all_read() from public,anon;
grant execute on function public.chat_bootstrap_read_state(),public.chat_unread_counts(),public.chat_mark_all_read() to authenticated;
create index if not exists chat_messages_room_created_sender_idx on public.chat_messages(room_id,created_at,sender_id);

create or replace function public.chat_mark_read(p_room uuid,p_last_read timestamptz) returns void language sql security invoker set search_path='' as $$ insert into public.chat_read_cursors(room_id,user_id,last_read_at) values(p_room,auth.uid(),least(p_last_read,clock_timestamp())) on conflict(room_id,user_id) do update set last_read_at=greatest(chat_read_cursors.last_read_at,excluded.last_read_at); $$;
