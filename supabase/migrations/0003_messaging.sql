-- 0003: Direct messaging — conversations, messages, reactions, corrections, saved phrases.
-- Stands alone; no other file merges into this concept.

-- ---------- Conversations ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique not null,                       -- "smaller uuid:larger uuid" => one DM per pair
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','request','ignored')),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index on public.conversation_members (user_id, status);

-- ---------- Messages ----------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz
);

create index messages_conv_created on public.messages (conversation_id, created_at desc);
create index on public.messages (sender_id, created_at desc);

-- ---------- Message Reactions (single reaction per user per message) ----------

create table public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  primary key (message_id, user_id, emoji)
);

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
    delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji = p_emoji;
    return false;
  end if;
  delete from message_reactions where message_id = p_message and user_id = auth.uid() and emoji <> p_emoji;
  insert into message_reactions (message_id, user_id, emoji) values (p_message, auth.uid(), p_emoji);
  return true;
end $$;

-- ---------- Message Corrections ----------

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

-- ---------- Saved Phrases ----------

create table public.saved_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phrase text not null check (char_length(phrase) between 1 and 500),
  translation text,
  language_id text references public.languages(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.saved_phrases (user_id, created_at desc);

-- ---------- Access control function ----------

create or replace function public.can_access_conversation(p_conv uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members m where m.conversation_id = p_conv and m.user_id = auth.uid())
     and not exists (select 1 from conversation_members o where o.conversation_id = p_conv and o.user_id <> auth.uid() and public.is_blocked_between(auth.uid(), o.user_id));
$$;