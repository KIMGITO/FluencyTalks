-- 0010: Single reaction per user per message.
-- Merges the toggle_reaction concept from 0012_single_reaction.sql.
-- Ensures one emoji per user per message; a second emoji replaces the first.

-- ---------- Message Reactions table ----------

create table if not exists public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  primary key (message_id, user_id, emoji)
);

-- ---------- Unique constraint: one reaction per user per message ----------

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'message_reactions_one_per_user') then
    alter table public.message_reactions add constraint message_reactions_one_per_user unique (message_id, user_id);
  end if;
end $$;

-- ---------- Toggle reaction function ----------

create or replace function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  perform assert_active();
  select conversation_id into v_conv from messages where id = p_message;
  if v_conv is null or not public.can_access_conversation(v_conv) then raise exception 'conversation_unavailable'; end if;
  if exists (select 1 from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji) then
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji;
    return false;
  end if;
  -- One emoji per user: a different emoji replaces the previous one.
  delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji <> p_emoji;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji);
  return true;
end $$;