-- 20241023000002: Messaging
-- Consolidates: 0003, 0012_single_reaction, 0013, 0014, 0016

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','request','ignored')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_members (user_id, status);
alter table public.conversation_members enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  language_id text references public.languages(id),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conv_created on public.messages (conversation_id, created_at desc);
create index on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;

create table public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 40),
  primary key (message_id, user_id, emoji),
  constraint message_reactions_one_per_user unique (message_id, user_id)
);
alter table public.message_reactions enable row level security;

create table public.message_corrections (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  corrector_id uuid not null references public.profiles(id) on delete cascade,
  suggested_text text not null check (char_length(suggested_text) between 1 and 4000),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now()
);
create index on public.message_corrections (message_id);
alter table public.message_corrections enable row level security;

-- Realtime
alter publication supabase_realtime add table public.messages;

-- ---------- Functions ----------
create function public.can_access_conversation(p_conv uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members m where m.conversation_id = p_conv and m.user_id = auth.uid())
     and not exists (select 1 from conversation_members o where o.conversation_id = p_conv and o.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), o.user_id)) $$;

create function public.list_conversations(p_status text default 'active')
returns table (conversation_id uuid, other_user_id uuid, other_name text, other_username text, other_avatar text, last_body text, last_at timestamptz, unread_count bigint, status text)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.display_name, o.username, o.avatar_url,
    lm.body,
    c.last_message_at,
    (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null and m.body <> '[deleted]' and m.created_at > me.last_read_at),
    me.status
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members om on om.conversation_id = c.id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  left join lateral (select body from messages where conversation_id = c.id and deleted_at is null and body <> '[deleted]' order by created_at desc limit 1) lm on true
  where me.user_id = auth.uid() and me.status = p_status and not public.is_blocked_between(auth.uid(), o.id)
  order by c.last_message_at desc limit 50 $$;

create function public.toggle_reaction(p_message uuid, p_emoji text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_conv uuid;
begin
  perform assert_active();
  select conversation_id into v_conv from messages where id = p_message;
  if v_conv is null or not public.can_access_conversation(v_conv) then raise exception 'conversation_unavailable'; end if;
  if exists (select 1 from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji) then
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji; return false;
  end if;
  -- One emoji per user: a different pick replaces the previous one.
  delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji <> p_emoji;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji); return true;
end $$;

create function public.peer_read_at(p_conv uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select m.last_read_at from conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid()
  order by m.last_read_at desc limit 1 $$;

-- ---------- Policies ----------
create policy "members read conversations" on public.conversations for select using (public.can_access_conversation(id));
create policy "read members" on public.conversation_members for select using (public.can_access_conversation(conversation_id));
create policy "read messages" on public.messages for select using (public.can_access_conversation(conversation_id));
create policy "send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.can_access_conversation(conversation_id) and exists (
    select 1 from conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid() and status = 'active'));
create policy "read reactions" on public.message_reactions for select using (exists (select 1 from messages where id = message_id and public.can_access_conversation(conversation_id)));
create policy "react to messages" on public.message_reactions for all using (exists (select 1 from messages where id = message_id and public.can_access_conversation(conversation_id)));
create policy "read corrections" on public.message_corrections for select using (exists (select 1 from messages where id = message_id and public.can_access_conversation(conversation_id)));
create policy "manage corrections" on public.message_corrections for all using (exists (select 1 from messages where id = message_id and public.can_access_conversation(conversation_id)));

grant execute on all functions in schema public to authenticated, service_role;

alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.message_reactions;
