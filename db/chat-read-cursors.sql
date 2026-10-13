create table if not exists public.chat_read_cursors (
 room_id uuid not null references public.chat_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null default '1970-01-01T00:00:00Z',
 primary key(room_id,user_id)
);
alter table public.chat_read_cursors enable row level security;
create policy "Read own chat cursor" on public.chat_read_cursors for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own joined-room cursor" on public.chat_read_cursors for insert to authenticated with check ((select auth.uid())=user_id and exists(select 1 from public.chat_members m where m.room_id=chat_read_cursors.room_id and m.user_id=(select auth.uid())));
create policy "Advance own joined-room cursor" on public.chat_read_cursors for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.chat_members m where m.room_id=chat_read_cursors.room_id and m.user_id=(select auth.uid())));
revoke all on public.chat_read_cursors from anon;
grant select,insert,update on public.chat_read_cursors to authenticated;
create index if not exists chat_read_cursors_user_idx on public.chat_read_cursors(user_id);
create or replace function public.chat_mark_read(p_room uuid,p_last_read timestamptz)
returns void language sql security invoker set search_path = '' as $$
 insert into public.chat_read_cursors(room_id,user_id,last_read_at)
 values(p_room,auth.uid(),least(p_last_read,now()))
 on conflict(room_id,user_id) do update set last_read_at=greatest(chat_read_cursors.last_read_at,excluded.last_read_at);
$$;
revoke all on function public.chat_mark_read(uuid,timestamptz) from public,anon;
grant execute on function public.chat_mark_read(uuid,timestamptz) to authenticated;
