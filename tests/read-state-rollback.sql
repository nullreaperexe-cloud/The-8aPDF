begin;
do $$
declare viewer uuid; sender uuid; room uuid; stamp timestamptz; before_count bigint; after_count bigint;
begin
 select a.user_id,b.user_id,a.room_id into viewer,sender,room from public.chat_members a join public.chat_members b on a.room_id=b.room_id and a.user_id<>b.user_id limit 1;
 if viewer is null then raise exception 'Need two existing room members for verification';end if;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 set local role authenticated;
 perform public.chat_bootstrap_read_state();perform public.chat_mark_all_read();
 select sum(unread_count) into before_count from public.chat_unread_counts();
 reset role;
 stamp:=clock_timestamp();
 insert into public.chat_messages(room_id,sender_id,body,created_at) values(room,sender,'Transactional read-count verification (rolled back)',stamp);
 insert into public.chat_messages(room_id,sender_id,body,created_at) values(room,viewer,'Transactional own-message verification (rolled back)',stamp);
 set local role authenticated;
 select sum(unread_count) into after_count from public.chat_unread_counts();
 if after_count<>before_count+1 then raise exception 'Incoming messages should add one; own messages should add zero';end if;
 perform public.chat_mark_read(room,stamp);
 select sum(unread_count) into after_count from public.chat_unread_counts();
 if after_count<>before_count then raise exception 'Read cursor did not clear the incoming message';end if;
 perform public.chat_mark_read(room,'1970-01-01');
 select sum(unread_count) into after_count from public.chat_unread_counts();
 if after_count<>before_count then raise exception 'Read cursor moved backwards';end if;
 if exists(select 1 from public.chat_read_cursors where user_id<>viewer) then raise exception 'Other users read cursors are visible';end if;
 reset role;
end $$;
rollback;
