-- 0012: single reaction per user per message (a second emoji replaces the first).
-- Keeps the newest reaction per (message_id, user_id), drops the older ones,
-- then enforces uniqueness so toggle_reaction can swap atomically.
delete from public.message_reactions a using public.message_reactions b
where a.message_id = b.message_id and a.user_id = b.user_id and a.emoji <> b.emoji
  and a.ctid < b.ctid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'message_reactions_one_per_user') then
    alter table public.message_reactions add constraint message_reactions_one_per_user unique (message_id, user_id);
  end if;
end $$;
create or replace function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  perform assert_active();
  select conversation_id into v_conv from messages where id = p_message;
  if v_conv is null or not public.can_access_conversation(v_conv) then raise exception 'conversation_unavailable'; end if;
  if exists (select 1 from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji) then
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji; return false;
  end if;
  -- One emoji per user: a different pick replaces the previous one (counts stay in sync).
  delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji <> p_emoji;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji); return true;
end $$;
