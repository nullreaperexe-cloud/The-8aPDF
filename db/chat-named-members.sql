-- Named-member list for Friends Chat. Non-destructive: no auth users, membership rows or messages are deleted.
-- Uses existing chat_members RLS to ensure callers see only rooms they belong to.
create or replace function public.chat_named_members(p_room uuid)
returns table (user_id uuid, role text, joined_at timestamptz, display_name text, last_seen timestamptz)
language sql stable security invoker set search_path = public, pg_temp
as $$
 select m.user_id, m.role, m.joined_at, btrim(p.display_name), p.last_seen
 from public.chat_members as m
 join public.chat_profiles as p on p.id=m.user_id
 where m.room_id=p_room and length(btrim(p.display_name))>0
 and lower(btrim(p.display_name)) not in ('friend','student')
 order by p.last_seen desc nulls last, m.joined_at asc
 limit 1000
$$;
revoke all on function public.chat_named_members(uuid) from public, anon;
grant execute on function public.chat_named_members(uuid) to authenticated;
