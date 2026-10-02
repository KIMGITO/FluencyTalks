-- 0003: direct messaging with message requests, reactions, corrections, phrasebook.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique not null,                       -- "<smaller uuid>:<larger uuid>" => one DM per pair
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), last_message_at timestamptz not null default now());
create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','request','ignored')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id));
create index on public.conversation_members (user_id, status);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz);
create index messages_conv_created on public.messages (conversation_id, created_at desc);
create index on public.messages (sender_id, created_at desc);
create table public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8), primary key (message_id, user_id, emoji));
create table public.message_corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  corrector_id uuid not null references public.profiles(id) on delete cascade,
  suggested_text text not null check (char_length(suggested_text) between 1 and 4000), note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')), created_at timestamptz not null default now());
create index on public.message_corrections (message_id);
create table public.saved_phrases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  phrase text not null check (char_length(phrase) <= 500), translation text, language_code text references public.languages(code),
  source_message_id uuid references public.messages(id) on delete set null, created_at timestamptz not null default now());
create index on public.saved_phrases (user_id, created_at desc);

-- Access = I'm a member AND nobody in the conversation is in a block relationship with me.
create function public.can_access_conversation(p_conv uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members m where m.conversation_id = p_conv and m.user_id = auth.uid())
     and not exists (select 1 from conversation_members o where o.conversation_id = p_conv and o.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), o.user_id)) $$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_corrections enable row level security;
alter table public.saved_phrases enable row level security;
-- Read-only for clients; every write is a function below.
create policy "read my conversations" on public.conversations for select using (public.can_access_conversation(id));
create policy "read members" on public.conversation_members for select using (public.can_access_conversation(conversation_id));
create policy "read messages" on public.messages for select using (public.can_access_conversation(conversation_id));
create policy "read reactions" on public.message_reactions for select using (exists (select 1 from public.messages m where m.id = message_id));
create policy "read corrections" on public.message_corrections for select using (exists (select 1 from public.messages m where m.id = message_id));
create policy "own phrases" on public.saved_phrases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime (Supabase-specific; the app wraps it in services/messaging.ts so it can be swapped).
alter publication supabase_realtime add table public.messages, public.message_reactions, public.message_corrections;

create function public.start_conversation(p_target uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_key text; v_id uuid; v_status text;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_message_self'; end if;
  if not exists (select 1 from profiles where id = p_target and status = 'active') or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  v_key := least(auth.uid()::text, p_target::text) || ':' || greatest(auth.uid()::text, p_target::text);
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    if (select count(*) from conversations where created_by = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;
    insert into conversations (direct_key, created_by) values (v_key, auth.uid()) returning id into v_id;
    -- Followed by the recipient => straight to their inbox. Otherwise it lands in Requests.
    v_status := case when exists (select 1 from follows where follower_id = p_target and followee_id = auth.uid() and status = 'accepted') then 'active' else 'request' end;
    insert into conversation_members (conversation_id, user_id, status) values (v_id, auth.uid(), 'active'), (v_id, p_target, v_status);
  end if;
  return v_id;
end $$;

create function public.send_message(p_conv uuid, p_body text, p_reply_to uuid default null) returns public.messages language plpgsql security definer set search_path = public as $$
declare m messages; v_other_status text; v_body text := btrim(p_body);
begin
  perform assert_active();
  if not public.can_access_conversation(p_conv) then raise exception 'conversation_unavailable'; end if;
  if v_body is null or char_length(v_body) = 0 then raise exception 'empty_message'; end if;
  select status into v_other_status from conversation_members where conversation_id = p_conv and user_id <> auth.uid();
  -- Until the recipient accepts a request, the sender gets exactly one message.
  if v_other_status = 'request' and exists (select 1 from messages where conversation_id = p_conv and sender_id = auth.uid()) then raise exception 'awaiting_acceptance'; end if;
  if (select count(*) from messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 30 then raise exception 'rate_limited'; end if;
  if p_reply_to is not null and not exists (select 1 from messages where id = p_reply_to and conversation_id = p_conv) then raise exception 'invalid_reply'; end if;
  insert into messages (conversation_id, sender_id, body, reply_to) values (p_conv, auth.uid(), v_body, p_reply_to) returning * into m;
  update conversations set last_message_at = m.created_at where id = p_conv;
  update conversation_members set last_read_at = m.created_at where conversation_id = p_conv and user_id = auth.uid();
  return m;
end $$;

create function public.respond_message_request(p_conv uuid, p_accept boolean) returns void language sql security definer set search_path = public as $$
  update conversation_members set status = case when p_accept then 'active' else 'ignored' end
  where conversation_id = p_conv and user_id = auth.uid() and status = 'request' $$;
create function public.mark_read(p_conv uuid) returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid() $$;

create function public.list_conversations(p_status text default 'active')
returns table (conversation_id uuid, other_user_id uuid, other_name text, other_username text, other_avatar text, last_body text, last_at timestamptz, unread_count bigint, status text)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.display_name, o.username, o.avatar_url, lm.body, c.last_message_at,
    (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null and m.created_at > me.last_read_at),
    me.status
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members om on om.conversation_id = c.id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  left join lateral (select body from messages where conversation_id = c.id and deleted_at is null order by created_at desc limit 1) lm on true
  where me.user_id = auth.uid() and me.status = p_status and not public.is_blocked_between(auth.uid(), o.id)
  order by c.last_message_at desc limit 50 $$;

create function public.edit_message(p_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update messages set body = left(btrim(p_body), 4000), edited_at = now() where id = p_id and sender_id = auth.uid() and deleted_at is null and char_length(btrim(p_body)) > 0;
end $$;
create function public.delete_message(p_id uuid) returns void language sql security definer set search_path = public as $$
  update messages set deleted_at = now(), body = '[deleted]' where id = p_id and sender_id = auth.uid() $$;

create function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  perform assert_active();
  select conversation_id into v_conv from messages where id = p_message;
  if v_conv is null or not public.can_access_conversation(v_conv) then raise exception 'conversation_unavailable'; end if;
  if exists (select 1 from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji) then
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji; return false;
  end if;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji); return true;
end $$;

-- In-chat corrections: a native speaker proposes a fix; the learner accepts or dismisses.
create function public.suggest_correction(p_message uuid, p_text text, p_note text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare m messages; v_id uuid;
begin
  perform assert_active();
  select * into m from messages where id = p_message;
  if not found or not public.can_access_conversation(m.conversation_id) then raise exception 'conversation_unavailable'; end if;
  if m.sender_id = auth.uid() then raise exception 'cannot_correct_self'; end if;
  insert into message_corrections (message_id, corrector_id, suggested_text, note) values (p_message, auth.uid(), btrim(p_text), p_note) returning id into v_id;
  return v_id;
end $$;
create function public.respond_correction(p_id uuid, p_accept boolean) returns void language sql security definer set search_path = public as $$
  update message_corrections c set status = case when p_accept then 'accepted' else 'dismissed' end
  from messages m where c.id = p_id and m.id = c.message_id and m.sender_id = auth.uid() and c.status = 'pending' $$;
