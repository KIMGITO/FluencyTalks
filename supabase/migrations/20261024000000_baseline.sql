-- BASELINE (version 20261024000000): the complete, tested schema, in one file.
--
-- This is the original migration chain 0001..0031 (kept in supabase/migrations_archive/) joined in
-- order, so it contains exactly the same statements that were tested. Every new change goes in a NEW
-- migration file after this one: never edit, merge or rewrite this file by hand.
--
-- Verify any change to the database with:  scripts/test-db.sh
--
-- Contents, in order:
--   0001-0010  tables, security rules, messaging, safety, storage, phrasebook, corrections, notifications, search
--   0011       ISO 639-3 languages
--   0012-0019  reactions, receipts, follow-back, avatars
--   0027       points + public phrase library columns
--   0028       removes the old blog/posts system
--   0029       restores function permissions, locks the points function
--   0030       one native + at most one learning language (set_language_profile)
--   0031       report reasons, points ledger, reward limits, message language column


-- ============================================================
-- from 0001_init.sql
-- ============================================================
-- FluencyTalks initial schema. Keep all schema changes as migrations in this folder.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique, display_name text, avatar_url text, bio text default '',
  timezone text, is_private boolean default false, created_at timestamptz default now()
);
create table public.user_languages (
  user_id uuid references public.profiles(id) on delete cascade,
  language_code text not null, role text check (role in ('native','learning')) not null,
  level text check (level in ('A1','A2','B1','B2','C1','C2','Native')),
  primary key (user_id, language_code, role)
);
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('pending','accepted')) default 'accepted',
  created_at timestamptz default now(), primary key (follower_id, followee_id)
);
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(), primary key (blocker_id, blocked_id)
);
create index on public.follows (followee_id); create index on public.blocks (blocked_id);

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;

-- Profiles are hidden from anyone who is blocked by the owner, or blocked the viewer.
create policy "profiles readable unless blocked" on public.profiles for select using (
  not exists (select 1 from public.blocks b where (b.blocker_id = id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = id)));
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own languages" on public.user_languages for all using (auth.uid() = user_id);
create policy "languages readable" on public.user_languages for select using (true);
create policy "follow as self" on public.follows for all using (auth.uid() = follower_id);
create policy "see own follow rows" on public.follows for select using (auth.uid() in (follower_id, followee_id));
create policy "manage own blocks" on public.blocks for all using (auth.uid() = blocker_id);

-- Auto-create a profile row on signup.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, display_name) values (new.id, split_part(new.email,'@',1)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();


-- ============================================================
-- from 0002_core_functions.sql
-- ============================================================
-- 0002: reference data, helpers, profile + social functions (follow/block/search).
-- Rule: clients READ via RLS, but WRITE sensitive things only through these functions.

-- ---------- Languages reference ----------
create table public.languages (code text primary key, name text not null, native_name text not null, rtl boolean not null default false);
insert into public.languages values
 ('en','English','English',false),('es','Spanish','Español',false),('fr','French','Français',false),('de','German','Deutsch',false),
 ('it','Italian','Italiano',false),('pt','Portuguese','Português',false),('sw','Swahili','Kiswahili',false),('ar','Arabic','العربية',true),
 ('he','Hebrew','עברית',true),('fa','Persian','فارسی',true),('zh','Chinese','中文',false),('ja','Japanese','日本語',false),
 ('ko','Korean','한국어',false),('hi','Hindi','हिन्दी',false),('ru','Russian','Русский',false),('tr','Turkish','Türkçe',false),
 ('nl','Dutch','Nederlands',false),('am','Amharic','አማርኛ',false),('yo','Yoruba','Yorùbá',false),('id','Indonesian','Bahasa Indonesia',false);
alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
alter table public.user_languages add constraint user_languages_language_fk foreign key (language_code) references public.languages(code);

-- ---------- Profile columns ----------
alter table public.profiles
  add column role text not null default 'user' check (role in ('user','moderator','admin')),
  add column status text not null default 'active' check (status in ('active','suspended','banned')),
  add column onboarding_done boolean not null default false,
  add column followers_count int not null default 0,
  add column following_count int not null default 0,
  add column updated_at timestamptz not null default now(),
  add constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index profiles_username_lower on public.profiles (lower(username));

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ---------- Helpers ----------
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator') and status = 'active') $$;

create function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;

create function public.assert_active() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then raise exception 'account_restricted'; end if;
end $$;

-- Users must not edit role/status/counters on their own row (server-side only).
create function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done then
      raise exception 'protected_columns';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();

-- ---------- Fix RLS from 0001 (blocked-by checks must see both directions) ----------
drop policy "profiles readable unless blocked" on public.profiles;
create policy "profiles readable unless blocked" on public.profiles for select
  using (auth.uid() = id or (status = 'active' and not public.is_blocked_between(auth.uid(), id)));
drop policy "follow as self" on public.follows;           -- writes go through follow_user()/unfollow_user()
drop policy "manage own blocks" on public.blocks;         -- writes go through block_user()/unblock_user()
create policy "see own blocks" on public.blocks for select using (auth.uid() = blocker_id);

-- ---------- Denormalised follow counters ----------
create function public.sync_follow_counts() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'UPDATE' and old.status <> 'accepted' and new.status = 'accepted' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' and old.status = 'accepted' then
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;
create trigger follows_counts after insert or update or delete on public.follows for each row execute function public.sync_follow_counts();

-- ---------- Profile functions ----------
create function public.set_my_languages(p_languages jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if jsonb_typeof(p_languages) <> 'array' or jsonb_array_length(p_languages) > 12 then raise exception 'invalid_languages'; end if;
  delete from user_languages where user_id = auth.uid();
  insert into user_languages (user_id, language_code, role, level)
  select auth.uid(), x.language_code, x.role, x.level
  from jsonb_to_recordset(p_languages) as x(language_code text, role text, level text)
  on conflict do nothing;   -- role/level/FK constraints validate the rest
end $$;

-- Saves profile fields and marks onboarding complete once a username and a language exist.
create function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update profiles set username = lower(p_username), display_name = left(btrim(p_display_name), 60), bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone, is_private = coalesce(p_is_private, false), avatar_url = coalesce(p_avatar_url, avatar_url)
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null) and exists (select 1 from user_languages where user_id = auth.uid()) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end $$;

create function public.get_profile(p_username text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v profiles;
begin
  select * into v from profiles where lower(username) = lower(p_username) and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), v.id) then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'username', v.username, 'display_name', v.display_name, 'avatar_url', v.avatar_url, 'bio', v.bio,
    'timezone', v.timezone, 'is_private', v.is_private, 'followers_count', v.followers_count, 'following_count', v.following_count,
    'languages', coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = v.id), '[]'::jsonb),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (p_query is null or p.display_name ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%')
    and (p_language is null or exists (select 1 from user_languages ul where ul.user_id = p.id and ul.language_code = p_language
         and (p_role is null or ul.role = p_role) and (p_level is null or ul.level = p_level)))
  order by p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset $$;
create index on public.user_languages (language_code, role, level);

-- ---------- Follow / block functions ----------
create function public.follow_user(p_target uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_private boolean;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_follow_self'; end if;
  select is_private into v_private from profiles where id = p_target and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), p_target) then raise exception 'user_unavailable'; end if;
  insert into follows (follower_id, followee_id, status) values (auth.uid(), p_target, case when v_private then 'pending' else 'accepted' end)
  on conflict (follower_id, followee_id) do nothing;
  return (select status from follows where follower_id = auth.uid() and followee_id = p_target);
end $$;

create function public.unfollow_user(p_target uuid) returns void language sql security definer set search_path = public as $$
  delete from follows where follower_id = auth.uid() and followee_id = p_target $$;

create function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_accept then update follows set status = 'accepted' where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  else delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending'; end if;
end $$;

create function public.list_follow_requests() returns table (follower_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.created_at from follows f join profiles p on p.id = f.follower_id
  where f.followee_id = auth.uid() and f.status = 'pending' and not public.is_blocked_between(auth.uid(), p.id) order by f.created_at desc $$;

create function public.list_follows(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text) language plpgsql stable security definer set search_path = public as $$
declare v_private boolean;
begin
  if public.is_blocked_between(auth.uid(), p_user) then return; end if;
  select pr.is_private into v_private from profiles pr where pr.id = p_user;
  if v_private and p_user <> auth.uid() and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p_user and f.status = 'accepted') then return; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_url from follows f
    join profiles p on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where f.status = 'accepted' and p.status = 'active'
      and ((p_kind = 'followers' and f.followee_id = p_user) or (p_kind = 'following' and f.follower_id = p_user))
      and not public.is_blocked_between(auth.uid(), p.id)
    order by f.created_at desc limit least(p_limit, 100) offset p_offset;
end $$;

-- Blocking is silent and removes follows in both directions.
create function public.block_user(p_target uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_block_self'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from follows where (follower_id = auth.uid() and followee_id = p_target) or (follower_id = p_target and followee_id = auth.uid());
end $$;
create function public.unblock_user(p_target uuid) returns void language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_target $$;
create function public.list_blocked() returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url from blocks b join profiles p on p.id = b.blocked_id where b.blocker_id = auth.uid() order by b.created_at desc $$;


-- ============================================================
-- from 0003_messaging.sql
-- ============================================================
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


-- ============================================================
-- from 0004_safety_moderation.sql
-- ============================================================
-- 0004: reporting, moderation, bans.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','inappropriate','impersonation','underage','scam','other')),
  details text check (char_length(details) <= 1000),
  evidence jsonb not null default '[]',                  -- snapshot of recent messages at report time
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null, resolved_at timestamptz,
  created_at timestamptz not null default now());
create index on public.reports (status, created_at);
create index on public.reports (target_user_id, created_at);
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(), admin_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('suspend','ban','reinstate','dismiss_report','auto_suspend')), reason text, created_at timestamptz not null default now());
create table public.banned_emails (email_hash text primary key, created_at timestamptz not null default now());

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.banned_emails enable row level security;
create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "admins read actions" on public.moderation_actions for select using (public.is_admin());
-- banned_emails: no policies => no client access at all.

create function public.email_hash(p_email text) returns text language sql immutable as $$
  select encode(sha256(convert_to(lower(btrim(p_email)), 'UTF8')), 'hex') $$;

-- Banned emails cannot sign up again.
create function public.block_banned_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from banned_emails where email_hash = public.email_hash(new.email)) then raise exception 'signup_not_allowed'; end if;
  return new;
end $$;
create trigger auth_block_banned before insert on auth.users for each row execute function public.block_banned_signup();

create function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evidence jsonb := '[]'; v_recent int;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_report_self'; end if;
  if p_conversation is not null and public.can_access_conversation(p_conversation) then
    select coalesce(jsonb_agg(e order by e->>'created_at'), '[]') into v_evidence from (
      select jsonb_build_object('id', id, 'sender_id', sender_id, 'body', body, 'created_at', created_at) as e
      from messages where conversation_id = p_conversation order by created_at desc limit 20) t;
  end if;
  insert into reports (reporter_id, target_user_id, conversation_id, reason, details, evidence)
  values (auth.uid(), p_target, p_conversation, p_reason, left(p_details, 1000), v_evidence) returning id into v_id;

  -- Many independent reporters in a week => restrict until a human reviews. Cheap defence against abuse waves.
  select count(distinct reporter_id) into v_recent from reports where target_user_id = p_target and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set status = 'suspended' where id = p_target and status = 'active' and role = 'user';
    insert into moderation_actions (target_user_id, action, reason) values (p_target, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;

create function public.admin_list_reports(p_status text default 'open') returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from reports where status = p_status order by created_at limit 100;
end $$;

create function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default null, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'invalid_status'; end if;
  if exists (select 1 from profiles where id = p_user and role <> 'user') and not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then raise exception 'forbidden'; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set status = p_status where id = p_user;
  if p_status = 'banned' then
    select email into v_email from auth.users where id = p_user;
    if v_email is not null then insert into banned_emails (email_hash) values (public.email_hash(v_email)) on conflict do nothing; end if;
  elsif p_status = 'active' then
    delete from banned_emails where email_hash = (select public.email_hash(email) from auth.users where id = p_user);
  end if;
  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), p_user, case p_status when 'active' then 'reinstate' when 'banned' then 'ban' else 'suspend' end, p_reason);
  if p_report is not null then update reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now() where id = p_report; end if;
end $$;

create function public.admin_dismiss_report(p_report uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where id = p_report;
  insert into moderation_actions (admin_id, action, reason) values (auth.uid(), 'dismiss_report', p_report::text);
end $$;


-- ============================================================
-- from 0005_storage_notifications_privacy.sql
-- ============================================================
-- 0005: avatars bucket, notifications, consent records, data export, function grants.

-- ---------- Avatars (public read, users write only inside their own folder: avatars/<uid>/...) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('follow','follow_request','follow_accepted','message_request','correction')),
  data jsonb not null default '{}', read_at timestamptz, created_at timestamptz not null default now());
create index on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (auth.uid() = user_id);
alter publication supabase_realtime add table public.notifications;

create function public.notify(p_user uuid, p_actor uuid, p_type text, p_data jsonb default '{}') returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, data) select p_user, p_actor, p_type, p_data where p_user is distinct from p_actor $$;

create function public.trg_notify_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform public.notify(new.followee_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  elsif old.status = 'pending' and new.status = 'accepted' then perform public.notify(new.follower_id, new.followee_id, 'follow_accepted'); end if;
  return null;
end $$;
create trigger follows_notify after insert or update on public.follows for each row execute function public.trg_notify_follow();

create function public.trg_notify_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'request' then perform public.notify(new.user_id, (select created_by from conversations where id = new.conversation_id), 'message_request', jsonb_build_object('conversation_id', new.conversation_id)); end if;
  return null;
end $$;
create trigger members_notify after insert on public.conversation_members for each row execute function public.trg_notify_request();

create function public.trg_notify_correction() returns trigger language plpgsql security definer set search_path = public as $$
declare m messages;
begin
  select * into m from messages where id = new.message_id;
  perform public.notify(m.sender_id, new.corrector_id, 'correction', jsonb_build_object('conversation_id', m.conversation_id, 'message_id', m.id));
  return null;
end $$;
create trigger corrections_notify after insert on public.message_corrections for each row execute function public.trg_notify_correction();

create function public.mark_notifications_read(p_ids uuid[] default null) returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids)) $$;

-- ---------- Consent records (terms, privacy, 18+) ----------
create table public.consents (
  user_id uuid references public.profiles(id) on delete cascade, kind text not null check (kind in ('terms','privacy','age_18')),
  version text not null, accepted_at timestamptz not null default now(), primary key (user_id, kind, version));
alter table public.consents enable row level security;
create policy "read own consents" on public.consents for select using (auth.uid() = user_id);
create function public.record_consent(p_kind text, p_version text) returns void language sql security definer set search_path = public as $$
  insert into consents (user_id, kind, version) values (auth.uid(), p_kind, p_version) on conflict do nothing $$;

-- ---------- GDPR-style export (account deletion = Edge Function `delete-account`, FKs cascade) ----------
create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'));
end $$;

-- ---------- Grants: only signed-in users may call functions. Re-run this block after adding new functions. ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;


-- ============================================================
-- from 0006_phrasebook_corrections.sql
-- ============================================================
-- 0006: phrasebook function + atomic "accept correction" (marks accepted AND saves the corrected phrase).
create unique index saved_phrases_user_phrase on public.saved_phrases (user_id, phrase);

create function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  -- Only keep the source link if I can actually see that message.
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_code, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), p_language, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

create function public.accept_correction(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare c message_corrections;
begin
  perform assert_active();
  select mc.* into c from message_corrections mc join messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  update message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);
end $$;

-- Re-apply grants for the new functions (signed-in users only).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;


-- ============================================================
-- from 0007_notifications_feed_admin.sql
-- ============================================================
-- 0007: notification feed (with actor details) and the read-side functions the admin screens need.
-- Writes still go through the functions from 0004 (admin_set_user_status, admin_dismiss_report).

-- ---------- Notifications: feed + unread count (hide anything from people I have a block with) ----------
create function public.list_notifications(p_limit int default 30)
returns table (id uuid, type text, data jsonb, read_at timestamptz, created_at timestamptz, actor_id uuid, actor_username text, actor_name text, actor_avatar text)
language sql stable security definer set search_path = public as $$
  select n.id, n.type, n.data, n.read_at, n.created_at, n.actor_id, p.username, p.display_name, p.avatar_url
  from notifications n left join profiles p on p.id = n.actor_id
  where n.user_id = auth.uid() and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id))
  order by n.created_at desc limit least(p_limit, 100) $$;

create function public.count_unread_notifications() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid() and n.read_at is null and (n.actor_id is null or not public.is_blocked_between(auth.uid(), n.actor_id)) $$;

-- ---------- Admin: report queue with names, target status and how many open reports the target has ----------
create function public.admin_report_queue(p_status text default 'open')
returns table (id uuid, reason text, details text, evidence jsonb, status text, created_at timestamptz, conversation_id uuid,
  reporter_id uuid, reporter_username text, reporter_name text,
  target_id uuid, target_username text, target_name text, target_status text, target_open_reports int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.reason, r.details, r.evidence, r.status, r.created_at, r.conversation_id,
           r.reporter_id, rp.username, rp.display_name,
           r.target_user_id, tp.username, tp.display_name, tp.status,
           (select count(*)::int from reports x where x.target_user_id = r.target_user_id and x.status = 'open')
    from reports r
    left join profiles rp on rp.id = r.reporter_id
    left join profiles tp on tp.id = r.target_user_id
    where r.status = p_status
    order by case when p_status = 'open' then r.created_at end asc nulls last, r.created_at desc   -- open: oldest first
    limit 100;
end $$;

-- ---------- Admin: find a person (no query = suspended/banned people first, then newest) ----------
create function public.admin_search_users(p_query text default null)
returns table (id uuid, username text, display_name text, role text, status text, created_at timestamptz, open_reports int)
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), ''); v_like text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
    select p.id, p.username, p.display_name, p.role, p.status, p.created_at,
           (select count(*)::int from reports r where r.target_user_id = p.id and r.status = 'open')
    from profiles p
    where p.username is not null and (v_like is null or p.username ilike v_like or p.display_name ilike v_like)
    order by (p.status <> 'active') desc, p.created_at desc
    limit 50;
end $$;

-- ---------- Admin: recent moderation activity ----------
create function public.admin_recent_actions(p_limit int default 50)
returns table (id uuid, action text, reason text, created_at timestamptz, admin_name text, target_username text, target_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.id, a.action, a.reason, a.created_at, ap.display_name, tp.username, tp.display_name
    from moderation_actions a
    left join profiles ap on ap.id = a.admin_id
    left join profiles tp on tp.id = a.target_user_id
    order by a.created_at desc limit least(p_limit, 100);
end $$;

-- Re-apply grants for the new functions (signed-in users only; the admin ones check is_admin() themselves).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;


-- ============================================================
-- from 0008_learning_history.sql
-- ============================================================
-- 0008: learning history — every translation a user asks for is stored and traceable
-- back to its source message, corrections get a listable history, reactions accept
-- full emoji-picker-react sequences (ZWJ / skin tones), translations join the data export.

-- ---------- Translation history ----------
create table public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_text text not null check (char_length(source_text) between 1 and 4000),
  translated_text text not null check (char_length(translated_text) between 1 and 4000),
  target_lang text references public.languages(code),
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now());
create index on public.translation_history (user_id, created_at desc);
alter table public.translation_history enable row level security;
create policy "own translations" on public.translation_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stores one row per (user, source text, target language): tapping Translate twice
-- must not spam the history. Only keeps the source link if the message is visible.
create function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
  if p_source_message is not null and not exists (select 1 from messages m where m.id = p_source_message and public.can_access_conversation(m.conversation_id)) then p_source_message := null; end if;
  -- Same text translated twice keeps one row (is not distinct from also covers null lang).
  select id into v_id from translation_history
  where user_id = auth.uid() and source_text = left(btrim(p_source), 4000)
    and target_lang is not distinct from p_lang;
  if v_id is not null then return v_id; end if;
  insert into translation_history (user_id, source_text, translated_text, target_lang, source_message_id)
  values (auth.uid(), left(btrim(p_source), 4000), left(btrim(p_translated), 4000), p_lang, p_source_message)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Correction history for the learner ----------
-- Everything that ever corrected MY messages, newest first: original text, who suggested
-- what, the note, the outcome, and the conversation so the row links back to the chat.
create function public.list_my_corrections()
returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         case when m.deleted_at is null then m.body else '[deleted]' end,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and (m.deleted_at is null or mc.status <> 'pending')
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc
  limit 200 $$;

-- ---------- Reactions: full emoji sequences from emoji-picker-react ----------
-- ZWJ sequences (family, professions) and skin-tone modifiers exceed 8 characters.
alter table public.message_reactions drop constraint message_reactions_emoji_check;
alter table public.message_reactions add constraint message_reactions_emoji_check check (char_length(emoji) <= 40);

-- ---------- Translations are personal data: include them in the GDPR export ----------
create or replace function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'role' - 'status' from profiles p where p.id = auth.uid()),
    'languages', coalesce((select jsonb_agg(to_jsonb(l)) from user_languages l where l.user_id = auth.uid()), '[]'),
    'following', coalesce((select jsonb_agg(to_jsonb(f)) from follows f where f.follower_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from blocks b where b.blocker_id = auth.uid()), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', m.conversation_id, 'body', m.body, 'created_at', m.created_at)) from messages m where m.sender_id = auth.uid()), '[]'),
    'saved_phrases', coalesce((select jsonb_agg(to_jsonb(s)) from saved_phrases s where s.user_id = auth.uid()), '[]'),
    'translations', coalesce((select jsonb_agg(to_jsonb(t)) from translation_history t where t.user_id = auth.uid()), '[]'),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from consents c where c.user_id = auth.uid()), '[]'));
end $$;

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors the 0005 block). ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;


-- ============================================================
-- from 0009_central_search.sql
-- ============================================================
-- 0009: one central search — search_people becomes the single people search used by
-- /search (handle with or without "@", relevance order, role/level filters that no
-- longer need a language, "people you follow" scope) and search_messages searches
-- my own chats so the search page can mix people and conversations like Facebook.

-- Old signature (0002) and the new one, so this file can be re-applied safely.
drop function if exists public.search_people(text, text, text, text, int, int);
drop function if exists public.search_people(text, text, text, text, text, int, int);

create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_language row has to satisfy every filter at once, and the filters
    -- apply on their own: picking only a role or only a level used to be ignored.
    and ((p_language is null and p_role is null and p_level is null)
      or exists (select 1 from user_languages ul where ul.user_id = p.id
           and (p_language is null or ul.language_code = p_language)
           and (p_role is null or ul.role = p_role)
           and (p_level is null or ul.level = p_level)))
  -- Relevance first: exact handle, then handle prefix, then name prefix, then anything else.
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

-- ---------- Conversations: find a message in the chats I belong to ----------
-- Membership, status and blocks are all checked here, so a hit can never leak a
-- conversation the viewer is not allowed to read. Both participants come back:
-- the sender for the row, the other person for the header and the chat link.
-- ilike '%..%' cannot use a btree index; add a pg_trgm GIN index on body
-- once a single account holds a large message history.
drop function if exists public.search_messages(text, uuid, int, int);
create function public.search_messages(p_query text default null, p_conversation uuid default null, p_limit int default 20, p_offset int default 0)
returns table (message_id uuid, conversation_id uuid, body text, created_at timestamptz, sender_id uuid, sender_name text, sender_username text, sender_avatar text, other_id uuid, other_name text, other_username text, other_avatar text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  v_q := nullif(btrim(coalesce(p_query, '')), '');
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select m.id, m.conversation_id, m.body, m.created_at,
    s.id, s.display_name, s.username, s.avatar_url,
    o.id, o.display_name, o.username, o.avatar_url
  from messages m
  join conversation_members me on me.conversation_id = m.conversation_id and me.user_id = auth.uid() and me.status in ('active', 'request')
  join profiles s on s.id = m.sender_id
  join conversation_members om on om.conversation_id = m.conversation_id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  where m.deleted_at is null and o.status = 'active'
    and not public.is_blocked_between(auth.uid(), o.id)
    and not public.is_blocked_between(auth.uid(), s.id)
    and (p_conversation is null or m.conversation_id = p_conversation)
    and (v_like is null or m.body ilike v_like)
  order by m.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors 0005/0008). ----------
-- Supabase's default privileges hand new functions to anon; searching is a signed-in feature.
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.search_messages(text, uuid, int, int) from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ============================================================
-- from 0010_country_home_feed.sql
-- ============================================================
-- 0010: country on the profile + the Home feed.
-- Two things: profiles get a country (a flag everywhere, derived from the timezone until
-- the user picks one themselves) and home_feed() becomes the Home list: people who share
-- one of my languages first, everyone else after a divider.

-- ---------- Countries reference (ISO 3166-1 alpha-2; the flag is derived from the code client-side) ----------
-- Written to be re-appliable: the table, the rows and the policy are all guarded, so a
-- re-run refreshes the list instead of failing on the objects it already created.
create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null
);
insert into public.countries (code, name) values
  ('AD','Andorra'),('AE','United Arab Emirates'),('AF','Afghanistan'),('AG','Antigua & Barbuda'),('AI','Anguilla'),
  ('AL','Albania'),('AM','Armenia'),('AO','Angola'),('AQ','Antarctica'),('AR','Argentina'),
  ('AS','American Samoa'),('AT','Austria'),('AU','Australia'),('AW','Aruba'),('AX','Åland Islands'),
  ('AZ','Azerbaijan'),('BA','Bosnia & Herzegovina'),('BB','Barbados'),('BD','Bangladesh'),('BE','Belgium'),
  ('BF','Burkina Faso'),('BG','Bulgaria'),('BH','Bahrain'),('BI','Burundi'),('BJ','Benin'),
  ('BL','Saint Barthélemy'),('BM','Bermuda'),('BN','Brunei'),('BO','Bolivia'),('BQ','Caribbean Netherlands'),
  ('BR','Brazil'),('BS','Bahamas'),('BT','Bhutan'),('BV','Bouvet Island'),('BW','Botswana'),
  ('BY','Belarus'),('BZ','Belize'),('CA','Canada'),('CC','Cocos (Keeling) Islands'),('CD','DR Congo'),
  ('CF','Central African Republic'),('CG','Republic of the Congo'),('CH','Switzerland'),('CI','Côte d’Ivoire'),('CK','Cook Islands'),
  ('CL','Chile'),('CM','Cameroon'),('CN','China'),('CO','Colombia'),('CR','Costa Rica'),
  ('CU','Cuba'),('CV','Cape Verde'),('CW','Curaçao'),('CX','Christmas Island'),('CY','Cyprus'),
  ('CZ','Czechia'),('DE','Germany'),('DJ','Djibouti'),('DK','Denmark'),('DM','Dominica'),
  ('DO','Dominican Republic'),('DZ','Algeria'),('EC','Ecuador'),('EE','Estonia'),('EG','Egypt'),
  ('EH','Western Sahara'),('ER','Eritrea'),('ES','Spain'),('ET','Ethiopia'),('FI','Finland'),
  ('FJ','Fiji'),('FK','Falkland Islands'),('FM','Micronesia'),('FO','Faroe Islands'),('FR','France'),
  ('GA','Gabon'),('GB','United Kingdom'),('GD','Grenada'),('GE','Georgia'),('GF','French Guiana'),
  ('GG','Guernsey'),('GH','Ghana'),('GI','Gibraltar'),('GL','Greenland'),('GM','Gambia'),
  ('GN','Guinea'),('GP','Guadeloupe'),('GQ','Equatorial Guinea'),('GR','Greece'),('GS','South Georgia & South Sandwich Islands'),
  ('GT','Guatemala'),('GU','Guam'),('GW','Guinea-Bissau'),('GY','Guyana'),('HK','Hong Kong'),
  ('HM','Heard & McDonald Islands'),('HN','Honduras'),('HR','Croatia'),('HT','Haiti'),('HU','Hungary'),
  ('ID','Indonesia'),('IE','Ireland'),('IL','Israel'),('IM','Isle of Man'),('IN','India'),
  ('IO','British Indian Ocean Territory'),('IQ','Iraq'),('IR','Iran'),('IS','Iceland'),('IT','Italy'),
  ('JE','Jersey'),('JM','Jamaica'),('JO','Jordan'),('JP','Japan'),('KE','Kenya'),
  ('KG','Kyrgyzstan'),('KH','Cambodia'),('KI','Kiribati'),('KM','Comoros'),('KN','St. Kitts & Nevis'),
  ('KP','North Korea'),('KR','South Korea'),('KW','Kuwait'),('KY','Cayman Islands'),('KZ','Kazakhstan'),
  ('LA','Laos'),('LB','Lebanon'),('LC','St. Lucia'),('LI','Liechtenstein'),('LK','Sri Lanka'),
  ('LR','Liberia'),('LS','Lesotho'),('LT','Lithuania'),('LU','Luxembourg'),('LV','Latvia'),
  ('LY','Libya'),('MA','Morocco'),('MC','Monaco'),('MD','Moldova'),('ME','Montenegro'),
  ('MF','Saint Martin'),('MG','Madagascar'),('MH','Marshall Islands'),('MK','North Macedonia'),('ML','Mali'),
  ('MM','Myanmar'),('MN','Mongolia'),('MO','Macao'),('MP','Northern Mariana Islands'),('MQ','Martinique'),
  ('MR','Mauritania'),('MS','Montserrat'),('MT','Malta'),('MU','Mauritius'),('MV','Maldives'),
  ('MW','Malawi'),('MX','Mexico'),('MY','Malaysia'),('MZ','Mozambique'),('NA','Namibia'),
  ('NC','New Caledonia'),('NE','Niger'),('NF','Norfolk Island'),('NG','Nigeria'),('NI','Nicaragua'),
  ('NL','Netherlands'),('NO','Norway'),('NP','Nepal'),('NR','Nauru'),('NU','Niue'),
  ('NZ','New Zealand'),('OM','Oman'),('PA','Panama'),('PE','Peru'),('PF','French Polynesia'),
  ('PG','Papua New Guinea'),('PH','Philippines'),('PK','Pakistan'),('PL','Poland'),('PM','St. Pierre & Miquelon'),
  ('PN','Pitcairn Islands'),('PR','Puerto Rico'),('PS','Palestine'),('PT','Portugal'),('PW','Palau'),
  ('PY','Paraguay'),('QA','Qatar'),('RE','Réunion'),('RO','Romania'),('RS','Serbia'),
  ('RU','Russia'),('RW','Rwanda'),('SA','Saudi Arabia'),('SB','Solomon Islands'),('SC','Seychelles'),
  ('SD','Sudan'),('SE','Sweden'),('SG','Singapore'),('SH','St. Helena'),('SI','Slovenia'),
  ('SJ','Svalbard & Jan Mayen'),('SK','Slovakia'),('SL','Sierra Leone'),('SM','San Marino'),('SN','Senegal'),
  ('SO','Somalia'),('SR','Suriname'),('SS','South Sudan'),('ST','São Tomé & Príncipe'),('SV','El Salvador'),
  ('SX','Sint Maarten'),('SY','Syria'),('SZ','Eswatini'),('TC','Turks & Caicos Islands'),('TD','Chad'),
  ('TF','French Southern Territories'),('TG','Togo'),('TH','Thailand'),('TJ','Tajikistan'),('TK','Tokelau'),
  ('TL','Timor-Leste'),('TM','Turkmenistan'),('TN','Tunisia'),('TO','Tonga'),('TR','Turkey'),
  ('TT','Trinidad & Tobago'),('TV','Tuvalu'),('TW','Taiwan'),('TZ','Tanzania'),('UA','Ukraine'),
  ('UG','Uganda'),('UM','U.S. Outlying Islands'),('US','United States'),('UY','Uruguay'),('UZ','Uzbekistan'),
  ('VA','Vatican City'),('VC','St. Vincent & Grenadines'),('VE','Venezuela'),('VG','British Virgin Islands'),('VI','U.S. Virgin Islands'),
  ('VN','Vietnam'),('VU','Vanuatu'),('WF','Wallis & Futuna'),('WS','Samoa'),('YE','Yemen'),
  ('YT','Mayotte'),('ZA','South Africa'),('ZM','Zambia'),('ZW','Zimbabwe')
-- Upsert rather than plain insert: a re-run corrects a spelling without duplicating rows,
-- and the `where` keeps it a no-op when nothing changed (so the table is left untouched).
on conflict (code) do update set name = excluded.name where public.countries.name is distinct from excluded.name;
alter table public.countries enable row level security;
drop policy if exists "countries public read" on public.countries;
create policy "countries public read" on public.countries for select using (true);
-- CREATE INDEX has no IF NOT EXISTS, so the index is named and dropped first (same
-- pattern as the policies in 0002). Unnamed indexes would collide on a re-apply.
drop index if exists public.countries_name_idx;
create index countries_name_idx on public.countries (name);

-- ---------- Country column: NULL means "serve my country from my timezone" ----------
alter table public.profiles add column if not exists country_code text references public.countries(code) on delete set null;
-- ---------- save_profile: one extra argument (p_country) ----------
-- Both the old (0002) and the new signature are dropped first, so this file can be
-- re-applied: create function fails outright if the signature already exists.
drop function if exists public.save_profile(text, text, text, text, boolean, text);
drop function if exists public.save_profile(text, text, text, text, boolean, text, text);
create function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  perform assert_active();
  -- An empty or unknown country is stored as NULL, i.e. "derive it from my timezone".
  select c.code into v_country from public.countries c where c.code = upper(btrim(coalesce(p_country, '')));
  update profiles set username = lower(p_username), display_name = left(btrim(p_display_name), 60), bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone, is_private = coalesce(p_is_private, false), avatar_url = coalesce(p_avatar_url, avatar_url),
    country_code = v_country
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null) and exists (select 1 from user_languages where user_id = auth.uid()) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end $$;

-- ---------- get_profile: same JSON plus country_code ----------
drop function if exists public.get_profile(text);
create function public.get_profile(p_username text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v profiles;
begin
  select * into v from profiles where lower(username) = lower(p_username) and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), v.id) then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'username', v.username, 'display_name', v.display_name, 'avatar_url', v.avatar_url, 'bio', v.bio,
    'timezone', v.timezone, 'country_code', v.country_code, 'is_private', v.is_private,
    'followers_count', v.followers_count, 'following_count', v.following_count,
    'languages', coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = v.id), '[]'::jsonb),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

-- ---------- search_people: unchanged except for country_code in the row ----------
drop function if exists public.search_people(text, text, text, text, text, int, int);
create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_language row has to satisfy every filter at once, and the filters
    -- apply on their own: picking only a role or only a level used to be ignored.
    and ((p_language is null and p_role is null and p_level is null)
      or exists (select 1 from user_languages ul where ul.user_id = p.id
           and (p_language is null or ul.language_code = p_language)
           and (p_role is null or ul.role = p_role)
           and (p_level is null or ul.level = p_level)))
  -- Relevance first: exact handle, then handle prefix, then name prefix, then anything else.
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;
-- ---------- home_feed: the Home list in one round trip ----------
-- One ordered result with two groups, so the page can split it however it likes.
-- A "partner" shares a language with me, in any combination:
--   'native'   = speaks natively a language I am learning            -> can teach me
--   'learning' = is learning one of my languages, or speaks natively a language I speak
--   'other'    = nothing in common                                   -> the rest of the app
-- Everyone is filtered exactly like search_people: active, finished onboarding, not me,
-- and never blocked in either direction (blocking stays silent in both directions).
-- p_partner_limit applies to each partner group, p_other_limit to everyone else.
drop function if exists public.home_feed(int, int);
create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    -- Empty arrays (no languages yet) simply match nobody, so everyone lands in 'other'.
    select array(select ul.language_code from user_languages ul where ul.user_id = auth.uid() and ul.role = 'native')   as native_langs,
           array(select ul.language_code from user_languages ul where ul.user_id = auth.uid() and ul.role = 'learning') as learning_langs
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('language_code', ul.language_code, 'role', ul.role, 'level', ul.level)) from user_languages ul where ul.user_id = p.id), '[]'::jsonb) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ul.role = 'native' and ul.language_code = any(mine.learning_langs)) then 'native'
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ((ul.role = 'learning' and ul.language_code = any(mine.native_langs))
               or (ul.role = 'learning' and ul.language_code = any(mine.learning_langs))
               or (ul.role = 'native'  and ul.language_code = any(mine.native_langs)))) then 'learning'
        else 'other'
      end as match_kind,
      -- Why they matched, for the badge on the card. First hit wins: what they can teach me,
      -- then what they want to learn, then the language we practise together, then the one we share.
      coalesce(
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_code = any(mine.learning_langs) order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_code = any(mine.native_langs)   order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_code = any(mine.learning_langs) order by ul.language_code limit 1),
        (select ul.language_code from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_code = any(mine.native_langs)   order by ul.language_code limit 1)
      ) as match_language
    from profiles p cross join mine
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
  from (
    (select c.* from candidates c where c.match_kind = 'native'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'learning'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  -- Partners first, everyone else after: the two lists the page draws, already in order.
  order by (feed.match_kind = 'other'), feed.followers_count desc, feed.created_at desc;
end $$;

-- ---------- Re-apply grants: only signed-in users may call functions (mirrors 0005/0008). ----------
revoke all on function public.save_profile(text, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.get_profile(text) from public, anon;
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.home_feed(int, int) from public, anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ============================================================
-- from 0011_iso_639_3_languages.sql
-- ============================================================
-- 0011: ISO 639-3 everywhere. A language is identified by the 3-letter code of the
-- standard, and nothing else -- no free-form strings, no app-specific abbreviations.
--
-- Before: public.languages(code, name, native_name, rtl) held a hand-written list of
-- 2-letter pseudo-codes ("zh", "sw", "jw"), and user_languages repeated that free text in
-- its own column. A typo stored a language that could never match anybody.
-- After:  public.languages is the single lookup, keyed by its ISO 639-3 id, and every
-- column that used to carry a string now carries that id:
--   user_languages.language_id       -> languages(id) on delete cascade
--   saved_phrases.language_id        -> languages(id) on delete set null
--   translation_history.language_id  -> languages(id) on delete set null
--
-- Rows already in the database are mapped through the only codes 0002 ever shipped, so no
-- profile loses a language. supabase/seed.sql then loads the curated list of 100 languages
-- (English + native names, ISO 639-1 where one exists, all offered as learning options).

begin;

-- ---------- 1. Release the old primary key ----------
alter table public.user_languages      drop constraint if exists user_languages_language_fk;
alter table public.saved_phrases       drop constraint if exists saved_phrases_language_code_fkey;
alter table public.translation_history drop constraint if exists translation_history_target_lang_fkey;
drop index if exists public.user_languages_language_code_role_level_idx;

-- ---------- 2. The lookup table, rebuilt on the standard ----------
drop table if exists public.languages;
create table public.languages (
  id                    text primary key check (id ~ '^[a-z]{3}$'),   -- ISO 639-3, always lowercase
  iso_639_1             text unique check (iso_639_1 is null or iso_639_1 ~ '^[a-z]{2}$'),  -- null when the standard has none
  english_name          text not null check (char_length(btrim(english_name)) between 1 and 80),
  native_name           text check (native_name is null or char_length(btrim(native_name)) between 1 and 80),  -- autonym, in its own script
  is_supported_learning boolean not null default true                 -- false keeps a language off every picker
);
comment on column public.languages.id is 'ISO 639-3 3-letter code; the only identifier the app stores';
comment on column public.languages.native_name is 'Autonym in the language''s own script; what the UI shows, English is the fallback';
comment on column public.languages.is_supported_learning is 'Offered in onboarding, the picker and the search filters';
create index languages_supported_learning_idx on public.languages (is_supported_learning, english_name);

alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
grant select on public.languages to anon, authenticated, service_role;

-- The 20 rows 0002 shipped, in their ISO 639-3 form: enough to carry existing profiles over.
-- seed.sql refreshes the names and adds the rest of the curated list. Note that the old 'zh'
-- split into the macrolanguage 'zho' (which keeps alpha-2 'zh') and Mandarin 'cmn' (which has
-- none), and that 'fa' became 'pes' (Persian) rather than the Dari 'prs'.
insert into public.languages (id, iso_639_1, english_name, native_name, is_supported_learning) values
  ('eng','en','English','English',true),        ('spa','es','Spanish','Español',true),
  ('fra','fr','French','Français',true),        ('deu','de','German','Deutsch',true),
  ('ita','it','Italian','Italiano',true),        ('por','pt','Portuguese','Português',true),
  ('swh','sw','Swahili','Kiswahili',true),      ('ara','ar','Arabic','العربية',true),
  ('heb','he','Hebrew','עברית',true),            ('pes','fa','Persian','فارسی',true),
  ('zho','zh','Chinese','中文',true),            ('cmn',null,'Mandarin Chinese','普通话',true),
  ('jpn','ja','Japanese','日本語',true),          ('kor','ko','Korean','한국어',true),
  ('hin','hi','Hindi','हिन्दी',true),             ('rus','ru','Russian','Русский',true),
  ('tur','tr','Turkish','Türkçe',true),          ('nld','nl','Dutch','Nederlands',true),
  ('amh','am','Amharic','አማርኛ',true),             ('yor','yo','Yoruba','Yorùbá',true),
  ('ind','id','Indonesian','Bahasa Indonesia',true)
on conflict (id) do nothing;

-- Every filter, form and RPC argument goes through this before it reaches a query, so
-- 'ENG', ' eng ' and 'Eng' all mean the same row, and anything that is not an ISO 639-3
-- code becomes null -- "no filter" rather than a search that can never match. The pattern is
-- the same one the primary key enforces, so this is a check and not a second opinion.
create or replace function public.normalize_language_code(p_code text) returns text
  language sql immutable as $$
  select case when lower(btrim(coalesce(p_code, ''))) ~ '^[a-z]{3}$'
              then lower(regexp_replace(btrim(coalesce(p_code, '')), '\s+', '', 'g'))
         end $$;

comment on function public.normalize_language_code(text) is
  'Canonical ISO 639-3 code: lower-cased, and null for anything that is not a well-formed 3-letter code (so a junk string means "no filter").';

-- ---------- 3. One code, one meaning ----------
-- The only legacy codes 0002 could have written, so no row is orphaned by the swap.
-- Kept in one place on purpose: add a mapping here only when a real database has old rows.
create or replace function public.legacy_language_id(p_code text) returns text
  language sql immutable as $$
  select m.new_id from (values
    ('en','eng'),('es','spa'),('fr','fra'),('de','deu'),('it','ita'),('pt','por'),('sw','swh'),
    ('ar','ara'),('he','heb'),('fa','pes'),('zh','cmn'),('ja','jpn'),('ko','kor'),('hi','hin'),
    ('ru','rus'),('tr','tur'),('nl','nld'),('am','amh'),('yo','yor'),('id','ind')) as m(old_id, new_id)
  where m.old_id = lower(btrim(coalesce(p_code, ''))) $$;

-- user_languages: swap the text column for the foreign key, then make it mandatory.
alter table public.user_languages add column language_id text references public.languages(id) on delete cascade;
update public.user_languages ul set language_id = public.legacy_language_id(ul.language_code);
-- A code the standard does not define cannot be expressed as an id, so that row goes.
delete from public.user_languages ul where ul.language_id is null
  or not exists (select 1 from public.languages l where l.id = ul.language_id);
alter table public.user_languages drop column language_code;   -- this also drops the old primary key, which used that column
alter table public.user_languages alter column language_id set not null;
-- The same key, now over the real reference: one row per (user, language, role).
alter table public.user_languages add constraint user_languages_pkey primary key (user_id, language_id, role);
create index user_languages_language_role_level_idx on public.user_languages (language_id, role, level);

-- The phrasebook and the translation history keep pointing at the same lookup.
alter table public.saved_phrases rename column language_code to language_id;
update public.saved_phrases s set language_id = public.legacy_language_id(s.language_id);
delete from public.saved_phrases s where s.language_id is not null
  and not exists (select 1 from public.languages l where l.id = s.language_id);
alter table public.saved_phrases add constraint saved_phrases_language_id_fkey
  foreign key (language_id) references public.languages(id) on delete set null;

alter table public.translation_history rename column target_lang to language_id;
update public.translation_history t set language_id = public.legacy_language_id(t.language_id);
delete from public.translation_history t where t.language_id is not null
  and not exists (select 1 from public.languages l where l.id = t.language_id);
alter table public.translation_history add constraint translation_history_language_id_fkey
  foreign key (language_id) references public.languages(id) on delete set null;

-- ---------- 4. Writes: only ids go in ----------
-- Reads the ISO 639-3 key and normalises it; `language_code` is accepted as a legacy alias
-- so a client that has not been rebuilt yet cannot store a value that silently disappears.
-- An id the table does not have is dropped rather than stored, but a bad role or level is a
-- client bug and fails the whole call -- a half-saved language list is worse than an error.
create or replace function public.set_my_languages(p_languages jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if jsonb_typeof(p_languages) <> 'array' or jsonb_array_length(p_languages) > 12 then raise exception 'invalid_languages'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_languages) as x(role text, level text)
    where x.role is null or x.role not in ('native', 'learning')
       or x.level is null or x.level not in ('A1','A2','B1','B2','C1','C2','Native')
  ) then raise exception 'invalid_languages'; end if;
  delete from public.user_languages where user_id = auth.uid();
  -- The join is the whitelist: an id the table does not have is dropped, not stored.
  insert into public.user_languages (user_id, language_id, role, level)
  select auth.uid(), v.language_id, x.role, x.level
  from jsonb_to_recordset(p_languages) as x(language_id text, language_code text, role text, level text)
  cross join lateral (select public.normalize_language_code(coalesce(x.language_id, x.language_code)) as language_id) v
  join public.languages l on l.id = v.language_id
  on conflict do nothing;   -- the same language listed twice is not an error
end $$;

-- ---------- 5. Reads: the ids come back joined, carrying their display name ----------
-- Every person-shaped payload returns `languages` as
-- { language_id, role, level, native_name, english_name }, so a card can print the autonym
-- without a second round trip and still fall back to English when there is no native script.
create or replace function public.user_languages_json(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'language_id', ul.language_id, 'role', ul.role, 'level', ul.level,
      'native_name', l.native_name, 'english_name', l.english_name)
      order by l.english_name)
    from public.user_languages ul join public.languages l on l.id = ul.language_id
    where ul.user_id = p_user), '[]'::jsonb) $$;

drop function if exists public.get_profile(text);
create function public.get_profile(p_username text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v profiles;
begin
  select * into v from profiles where lower(username) = lower(p_username) and status = 'active';
  if not found or public.is_blocked_between(auth.uid(), v.id) then return null; end if;
  return jsonb_build_object(
    'id', v.id, 'username', v.username, 'display_name', v.display_name, 'avatar_url', v.avatar_url, 'bio', v.bio,
    'timezone', v.timezone, 'country_code', v.country_code, 'is_private', v.is_private,
    'followers_count', v.followers_count, 'following_count', v.following_count,
    'languages', public.user_languages_json(v.id),
    'relationship', jsonb_build_object(
      'is_me', v.id = auth.uid(),
      'following', (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = v.id),
      'follows_me', exists (select 1 from follows f where f.follower_id = v.id and f.followee_id = auth.uid() and f.status = 'accepted')));
end $$;

-- ---------- 6. search_people: relational matching on fixed identifiers ----------
-- p_language is an ISO 639-3 id. It is lower-cased here, and an id the table does not have
-- is treated as "no language filter" instead of a query that silently returns nobody.
drop function if exists public.search_people(text, text, text, text, text, int, int);
create function public.search_people(p_query text default null, p_language text default null, p_role text default null, p_level text default null, p_scope text default 'everyone', p_limit int default 20, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text)
language plpgsql stable security definer set search_path = public as $$
declare v_q text; v_like text; v_lang text; v_role text; v_level text;
begin
  -- "@sara" and "sara" are the same search; "%" and "_" must be escaped or they act as wildcards.
  v_q := lower(nullif(btrim(coalesce(p_query, '')), ''));
  if v_q is not null then v_q := nullif(ltrim(v_q, '@'), ''); end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;

  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  v_role := nullif(btrim(coalesce(p_role, '')), '');
  if v_role is not null and v_role not in ('native', 'learning') then v_role := null; end if;
  v_level := nullif(btrim(coalesce(p_level, '')), '');
  if v_level is not null and v_level not in ('A1','A2','B1','B2','C1','C2','Native') then v_level := null; end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private, p.followers_count,
    public.user_languages_json(p.id),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
    and not public.is_blocked_between(auth.uid(), p.id)
    and (v_like is null or p.display_name ilike v_like or p.username ilike v_like)
    and (coalesce(p_scope, 'everyone') <> 'following'
      or exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'))
    -- One user_languages row has to satisfy every filter at once, and each filter also works
    -- on its own. The join to languages is what makes the id a real reference, not a string.
    and ((v_lang is null and v_role is null and v_level is null)
      or exists (select 1 from user_languages ul
           join languages l on l.id = ul.language_id
           where ul.user_id = p.id
             and (v_lang is null or l.id = v_lang)
             and (v_role is null or ul.role = v_role)
             and (v_level is null or ul.level = v_level)))
  -- Relevance first: exact handle, then handle prefix, then name prefix, then anything else.
  order by case
      when v_q is null or p.username is null then 3
      when lower(p.username) = v_q then 0
      when lower(p.username) like v_q || '%' then 1
      when lower(p.display_name) like v_q || '%' then 2
      else 3 end,
    p.followers_count desc, p.created_at desc
  limit least(p_limit, 50) offset p_offset;
end $$;

-- ---------- 7. home_feed: the same identifiers, matched both ways ----------
--   'native'   = speaks natively a language I am learning            -> can teach me
--   'learning' = is learning one of my languages, or speaks natively a language I speak
--   'other'    = nothing in common                                   -> the rest of the app
drop function if exists public.home_feed(int, int);
create function public.home_feed(p_partner_limit int default 12, p_other_limit int default 8)
returns table (id uuid, username text, display_name text, avatar_url text, bio text, timezone text, country_code text, is_private boolean, followers_count int, languages jsonb, follow_status text, match_kind text, match_language text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with mine as (
    -- Empty arrays (no languages yet) simply match nobody, so everyone lands in 'other'.
    select array(select ul.language_id from user_languages ul where ul.user_id = auth.uid() and ul.role = 'native')   as native_langs,
           array(select ul.language_id from user_languages ul where ul.user_id = auth.uid() and ul.role = 'learning') as learning_langs
  ), candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.timezone, p.country_code, p.is_private,
      p.followers_count, p.created_at,
      public.user_languages_json(p.id) as languages,
      (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id) as follow_status,
      case
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ul.role = 'native' and ul.language_id = any(mine.learning_langs)) then 'native'
        when exists (select 1 from user_languages ul where ul.user_id = p.id
             and ((ul.role = 'learning' and ul.language_id = any(mine.native_langs))
               or (ul.role = 'learning' and ul.language_id = any(mine.learning_langs))
               or (ul.role = 'native'  and ul.language_id = any(mine.native_langs)))) then 'learning'
        else 'other'
      end as match_kind,
      -- Why they matched, for the badge on the card. First hit wins: what they can teach me,
      -- then what they want to learn, then the language we practise together, then the one we share.
      coalesce(
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'learning' and ul.language_id = any(mine.learning_langs) order by ul.language_id limit 1),
        (select ul.language_id from user_languages ul where ul.user_id = p.id and ul.role = 'native'   and ul.language_id = any(mine.native_langs)   order by ul.language_id limit 1)
      ) as match_language
    from profiles p cross join mine
    where p.id <> auth.uid() and p.status = 'active' and p.onboarding_done
      and not public.is_blocked_between(auth.uid(), p.id)
  )
  -- Every column is table-qualified: plpgsql would treat a bare "id" or "languages" as the
  -- function's OUT parameter and refuse the query as ambiguous.
  select feed.id, feed.username, feed.display_name, feed.avatar_url, feed.bio, feed.timezone, feed.country_code,
    feed.is_private, feed.followers_count, feed.languages, feed.follow_status, feed.match_kind, feed.match_language
  from (
    (select c.* from candidates c where c.match_kind = 'native'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'learning'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_partner_limit, 12), 50), 0))
    union all
    (select c.* from candidates c where c.match_kind = 'other'
      order by c.followers_count desc, c.created_at desc limit greatest(least(coalesce(p_other_limit, 8), 50), 0))
  ) feed
  -- Partners first, everyone else after: the two lists the page draws, already in order.
  order by (feed.match_kind = 'other'), feed.followers_count desc, feed.created_at desc;
end $$;

-- ---------- 8. Learning history: an ISO 639-3 id, or nothing at all ----------
-- p_lang / p_language are ISO 639-3 ids, same rule as search_people: normalised, and
-- dropped when the table has no such id, so history never records a code that means nothing.
create or replace function public.save_translation(p_source text, p_translated text, p_lang text default null, p_source_message uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_source, ''))) = 0 or char_length(btrim(coalesce(p_translated, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_lang);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  if p_source_message is not null and not exists (select 1 from messages m where m.id = p_source_message and public.can_access_conversation(m.conversation_id)) then p_source_message := null; end if;
  -- Same text translated twice keeps one row (is not distinct from also covers no language).
  select t.id into v_id from translation_history t
  where t.user_id = auth.uid() and t.source_text = left(btrim(p_source), 4000)
    and t.language_id is not distinct from v_lang;
  if v_id is not null then return v_id; end if;
  insert into translation_history (user_id, source_text, translated_text, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_source), 4000), left(btrim(p_translated), 4000), v_lang, p_source_message)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_phrase(p_phrase text, p_translation text default null, p_language text default null, p_source uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_lang text;
begin
  perform assert_active();
  if char_length(btrim(coalesce(p_phrase, ''))) = 0 then raise exception 'empty_message'; end if;
  v_lang := public.normalize_language_code(p_language);
  if v_lang is not null and not exists (select 1 from languages l where l.id = v_lang) then v_lang := null; end if;
  -- Only keep the source link if I can actually see that message.
  if p_source is not null and not exists (select 1 from messages m where m.id = p_source and public.can_access_conversation(m.conversation_id)) then p_source := null; end if;
  insert into saved_phrases (user_id, phrase, translation, language_id, source_message_id)
  values (auth.uid(), left(btrim(p_phrase), 500), left(p_translation, 500), v_lang, p_source)
  on conflict (user_id, phrase) do update set translation = coalesce(excluded.translation, saved_phrases.translation)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- 9. Grants: reference data is readable by anyone, RPCs stay signed-in only ----------
revoke all on function public.save_profile(text, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.get_profile(text) from public, anon;
revoke all on function public.search_people(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.home_feed(int, int) from public, anon;
revoke all on function public.user_languages_json(uuid) from public, anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

commit;

-- ============================================================
-- from 0012_single_reaction.sql
-- ============================================================
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


-- ============================================================
-- from 0013_deleted_preview.sql
-- ============================================================
-- 0013: deleted last message shows a "deleted" placeholder in the chat list preview
-- instead of falling through to an older message (or "No messages yet").
create or replace function public.list_conversations(p_status text default 'active')
returns table (conversation_id uuid, other_user_id uuid, other_name text, other_username text, other_avatar text, last_body text, last_at timestamptz, unread_count bigint, status text)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.display_name, o.username, o.avatar_url,
    case when lm.deleted_at is not null then 'This message was deleted.' else lm.body end,
    c.last_message_at,
    (select count(*) from messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null and m.created_at > me.last_read_at),
    me.status
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members om on om.conversation_id = c.id and om.user_id <> auth.uid()
  join profiles o on o.id = om.user_id
  left join lateral (select body, deleted_at from messages where conversation_id = c.id order by created_at desc limit 1) lm on true
  where me.user_id = auth.uid() and me.status = p_status and not public.is_blocked_between(auth.uid(), o.id)
  order by c.last_message_at desc limit 50 $$;


-- ============================================================
-- from 0014_hide_deleted.sql
-- ============================================================
-- 0014: deleted messages vanish globally — never a placeholder, never searchable.
-- list_conversations previews the last *visible* message (deleted rows are skipped,
-- "No messages yet" falls out as null), correction history drops deleted originals,
-- and report evidence snapshots skip deleted rows. Every reader checks deleted_at
-- first so a deleted body can never leak back into any UI.
create or replace function public.list_conversations(p_status text default 'active')
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

-- Correction history: a deleted original is gone everywhere, not kept as "[deleted]".
create or replace function public.list_my_corrections()
returns table (
  id uuid, message_id uuid, conversation_id uuid, original_text text,
  suggested_text text, note text, status text,
  corrector_id uuid, corrector_name text, corrector_username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mc.id, mc.message_id, m.conversation_id,
         m.body,
         mc.suggested_text, mc.note, mc.status,
         mc.corrector_id, coalesce(p.display_name, p.username), p.username, mc.created_at
  from message_corrections mc
  join messages m on m.id = mc.message_id
  join profiles p on p.id = mc.corrector_id
  where m.sender_id = auth.uid()
    and m.deleted_at is null and m.body <> '[deleted]'
    and public.can_access_conversation(m.conversation_id)
  order by mc.created_at desc
  limit 200 $$;

-- Report evidence: snapshot only visible messages so moderators never see "[deleted]".
create or replace function public.report_user(p_target uuid, p_reason text, p_details text default null, p_conversation uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_evidence jsonb := '[]'; v_recent int;
begin
  perform assert_active();
  if p_target = auth.uid() then raise exception 'cannot_report_self'; end if;
  if p_conversation is not null and public.can_access_conversation(p_conversation) then
    select coalesce(jsonb_agg(e order by e->>'created_at'), '[]') into v_evidence from (
      select jsonb_build_object('id', id, 'sender_id', sender_id, 'body', body, 'created_at', created_at) as e
      from messages where conversation_id = p_conversation and deleted_at is null and body <> '[deleted]' order by created_at desc limit 20) t;
  end if;
  insert into reports (reporter_id, target_user_id, conversation_id, reason, details, evidence)
  values (auth.uid(), p_target, p_conversation, p_reason, left(p_details, 1000), v_evidence) returning id into v_id;

  select count(distinct reporter_id) into v_recent from reports where target_user_id = p_target and created_at > now() - interval '7 days';
  if v_recent >= 5 then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set status = 'suspended' where id = p_target and status = 'active' and role = 'user';
    insert into moderation_actions (target_user_id, action, reason) values (p_target, 'auto_suspend', v_recent || ' reports in 7 days');
  end if;
  return v_id;
end $$;


-- ============================================================
-- from 0015_follow_back.sql
-- ============================================================
-- 0015: answering a follow request follows back — "Follow back" + "Cancel", not Accept/Decline.
-- Accepting marks their pending follow accepted AND creates my accepted follow to them,
-- so both lists stay mutual. Works even if the follower is private (an accepted row
-- bypasses their request queue). Cancel just deletes their pending request.
create or replace function public.respond_follow_request(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if p_follower = auth.uid() then raise exception 'cannot_follow_self'; end if;
  if p_accept then
    update follows set status = 'accepted'
    where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
    if not found then return; end if;
    if public.is_blocked_between(auth.uid(), p_follower) then
      delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'accepted';
      raise exception 'user_unavailable';
    end if;
    -- My side: an accepted row regardless of their privacy (they already asked to connect).
    insert into follows (follower_id, followee_id, status)
    values (auth.uid(), p_follower, 'accepted')
    on conflict (follower_id, followee_id) do update set status = 'accepted';
  else
    delete from follows where follower_id = p_follower and followee_id = auth.uid() and status = 'pending';
  end if;
end $$;


-- ============================================================
-- from 0016_message_receipts.sql
-- ============================================================
-- 0016: message read receipts. The other member's last_read_at is the only new
-- signal: any of my messages created at or before it has been read. No new
-- tables, no per-message writes — ticks derive from conversation_members,
-- which members can already read (policy "read members" in 0003).
create or replace function public.peer_read_at(p_conv uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select m.last_read_at from conversation_members m
  where m.conversation_id = p_conv and m.user_id <> auth.uid()
  order by m.last_read_at desc limit 1
$$;
grant execute on function public.peer_read_at(uuid) to authenticated, service_role;
-- Live ticks: the app subscribes to UPDATEs on conversation_members (ChatThread),
-- so the peer's row must be in the realtime publication.
alter publication supabase_realtime add table public.conversation_members;


-- ============================================================
-- from 0017_notifications_delete.sql
-- ============================================================
-- 0017: notification deletes. "Mark all as read" reads + deletes the feed,
-- and each row gets its own delete button. Deletes go through a security-definer
-- function (RLS has no delete policy otherwise), plus a direct delete policy so
-- the client can also delete via PostgREST if needed.
create policy "delete own notifications" on public.notifications for delete using (auth.uid() = user_id);

create function public.delete_notifications(p_ids uuid[] default null) returns void
language sql security definer set search_path = public as $$
  delete from notifications where user_id = auth.uid() and (p_ids is null or id = any(p_ids)) $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ============================================================
-- from 0018_provider_avatar.sql
-- ============================================================
-- 0018: backfill profile photos from the auth provider (Google etc).
-- New signups copy avatar_url/picture/full_name into the profile row; existing
-- users keep their photo unless they never set one (their row is backfilled).
-- save_profile already does avatar_url = coalesce(p_avatar_url, avatar_url),
-- so passing null from the form keeps whatever is stored — no change needed
-- there. The client falls back to the session's user_metadata image (then
-- initials) whenever the stored avatar is empty.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email,'@',1)),
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), ''));
  return new;
end $$;

-- One-off backfill for rows created before this migration (only where empty).
update public.profiles p set avatar_url = u.raw_user_meta_data->>'avatar_url'
from auth.users u where u.id = p.id and (p.avatar_url is null or p.avatar_url = '')
  and nullif(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), '') is not null;
update public.profiles p set avatar_url = u.raw_user_meta_data->>'picture'
from auth.users u where u.id = p.id and (p.avatar_url is null or p.avatar_url = '')
  and nullif(u.raw_user_meta_data->>'picture', '') is not null;

-- ============================================================
-- from 0019_follow_languages.sql
-- ============================================================
-- 0019: Follow lists carry languages so /followers and /following can print
-- the same chips as search/home without a second round trip.
-- Same payload shape as search_people/home_feed: user_languages_json(p.id).

begin;

drop function if exists public.list_follows(uuid, text, int, int);

create function public.list_follows(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_url text, languages jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_private boolean;
begin
  if public.is_blocked_between(auth.uid(), p_user) then return; end if;
  select pr.is_private into v_private from profiles pr where pr.id = p_user;
  if v_private and p_user <> auth.uid() and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p_user and f.status = 'accepted') then return; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_url,
      public.user_languages_json(p.id)
    from follows f
    join profiles p on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
    where f.status = 'accepted' and p.status = 'active'
      and ((p_kind = 'followers' and f.followee_id = p_user) or (p_kind = 'following' and f.follower_id = p_user))
      and not public.is_blocked_between(auth.uid(), p.id)
    order by f.created_at desc limit least(p_limit, 100) offset p_offset;
end $$;

revoke all on function public.list_follows(uuid, text, int, int) from public, anon;
grant execute on function public.list_follows(uuid, text, int, int) to authenticated, service_role;

commit;


-- ============================================================
-- from 0027_points_and_library_upgrade.sql
-- ============================================================
-- 0027: Points economy + public phrasebook library with Unsplash visual anchors.
--
-- NOTE on numbering: 0012 is already taken by 0012_single_reaction.sql, so this
-- ships as 0027 (the next free version after 0026).
--
-- 1. points_balance on profiles (default 100). Readable by anyone who can view
--    the profile, but never writable directly by clients: it is guarded by
--    protect_profile_columns() and only adjust_user_points() (security definer,
--    bypass_protect) may change it.
-- 2. adjust_user_points(user_id, amount): the single safe primitive for moving
--    points. A caller may only spend their own points (negative amount on their
--    own id) or credit another user (positive amount on a different id). A
--    client can therefore never inflate their own balance or drain someone else.
--    Raises if the target is missing or the balance would go negative.
-- 3. accept_correction() now pays the native helper +5 points when a correction
--    is finalized.
-- 4. saved_phrases gains is_public + unsplash_image_url for public vocabulary
--    decks with safe Unsplash visual anchors (URL strings only; no binaries).
-- 5. Bounty flagging (spend 50, transfer to helper) is built on top of
--    adjust_user_points in a later step; the primitive already enforces the
--    sufficient-balance check so no points can be created out of thin air.

-- ---------- 1. points_balance column ----------
alter table public.profiles
  add column if not exists points_balance int not null default 100;

-- Backfill profiles created before this migration.
update public.profiles set points_balance = 100 where points_balance is null;

-- ---------- 2. Guard points_balance from direct client edits ----------
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

-- ---------- 3. Safe point adjustment primitive ----------
create or replace function public.adjust_user_points(p_user_id uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  perform assert_active();

  if p_user_id is null then raise exception 'points_user_required'; end if;

  -- Self: only spending (negative) is allowed. Never credit yourself.
  if p_user_id = auth.uid() then
    if p_amount > 0 then raise exception 'points_self_credit_not_allowed'; end if;
  else
    -- Others: only crediting (positive) is allowed. Never spend someone else's points.
    if p_amount < 0 then raise exception 'points_spend_other_not_allowed'; end if;
  end if;

  select points_balance into v_balance from public.profiles where id = p_user_id;
  if not found then raise exception 'points_user_not_found'; end if;
  if v_balance + p_amount < 0 then raise exception 'insufficient_points'; end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles
  set points_balance = points_balance + p_amount
  where id = p_user_id;
end $$;

-- ---------- 4. Reward the helper when a correction is accepted ----------
create or replace function public.accept_correction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c message_corrections;
begin
  perform assert_active();
  select mc.* into c from message_corrections mc join messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  update message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);
  -- Native helper earns 5 points for a successfully finalized correction.
  perform public.adjust_user_points(c.corrector_id, 5);
end $$;

-- ---------- 5. Public phrasebook library + Unsplash visual anchors ----------
alter table public.saved_phrases
  add column if not exists is_public boolean not null default false,
  add column if not exists unsplash_image_url text;

create index if not exists saved_phrases_public_idx on public.saved_phrases (is_public, created_at desc) where is_public;

-- Anyone may read public phrases (the shared library). Owners retain full
-- control of their own phrases via the existing "own phrases" policy.
create policy "read public phrases" on public.saved_phrases for select
  using (is_public or auth.uid() = user_id);

-- ---------- Grants (match existing convention: signed-in clients only) ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ============================================================
-- from 0028_drop_posts_system.sql
-- ============================================================
-- 0028: remove the story/blog system entirely.
-- Drops every object introduced by 0020-0026 (posts, post_reads, post_saves,
-- post_notes, the post-images bucket and its policies, and all post RPCs).
-- Safe to run on a fresh DB (uses IF EXISTS / WHERE id = ...) and on an
-- existing DB that already has the posts system applied.

-- 1. Revoke + drop every post RPC first (they reference the posts tables).
revoke execute on all functions in schema public from public, anon, authenticated, service_role;

drop function if exists public.list_posts(text, boolean, boolean, integer, integer) cascade;
drop function if exists public.get_post(uuid) cascade;
drop function if exists public.toggle_post_read(uuid) cascade;
drop function if exists public.list_post_readers(uuid) cascade;
drop function if exists public.toggle_post_save(uuid) cascade;
drop function if exists public.add_post_note(uuid, text) cascade;
drop function if exists public.list_post_notes(uuid) cascade;
drop function if exists public.delete_post_note(uuid) cascade;
drop function if exists public.create_post(text, text, jsonb, text, text, text) cascade;
drop function if exists public.update_post(uuid, text, jsonb, text, text, text) cascade;
drop function if exists public.delete_post(uuid) cascade;
drop function if exists public.list_public_blogs(integer, integer) cascade;
drop function if exists public.get_public_blog(uuid) cascade;
drop function if exists public.post_visible_to(uuid, text) cascade;

-- 2. Drop the posts tables (cascade drops their indexes, constraints, RLS policies,
--    and the join tables post_reads / post_saves / post_notes).
drop table if exists public.post_notes cascade;
drop table if exists public.post_saves cascade;
drop table if exists public.post_reads cascade;
drop table if exists public.posts cascade;

-- 3. Storage: remove the post-images policies.
--    The bucket itself is NOT deleted here: hosted Supabase forbids direct DELETEs on storage
--    tables ("Use the Storage API instead"). It only ever existed on databases that ran the removed
--    posts migrations; a database built from these files never creates it. If yours has an old
--    `post-images` bucket, delete it in the dashboard (Storage) or with the Storage API.
drop policy if exists "post images public read" on storage.objects;
drop policy if exists "post images insert own" on storage.objects;
drop policy if exists "post images delete own" on storage.objects;


-- ============================================================
-- from 0029_restore_grants_lock_points.sql
-- ============================================================
-- 0029: repair after 0028 and close the points exploit.
--
-- 1. 0028 ran `revoke execute on all functions ... from authenticated, service_role`
--    and never granted it back, so after 0028 signed-in clients could not call any RPC
--    (and any RLS policy that calls a function, such as is_admin(), could fail).
--    Restore the project convention: signed-in users and the service role only.
-- 2. adjust_user_points() let any signed-in client credit ANY other user an unlimited
--    amount through a direct RPC call. It is now internal-only: security definer
--    functions (accept_correction, later the bounty functions) still call it, but
--    clients cannot.
--
-- Safe to run more than once.

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Internal only: no direct client access.
revoke execute on function public.adjust_user_points(uuid, int) from public, anon, authenticated;


-- ============================================================
-- from 0030_single_language_profile.sql
-- ============================================================
-- 0030: one native language, at most one learning language.
--
-- Rules (enforced HERE, not only in the UI):
--   * exactly one native language is required; at most one learning language, with a CEFR level
--   * they cannot be the same language
--   * only launch-list languages can be chosen (languages.is_supported_learning)
--   * changing a language is free the first time, then once per 30 days (level changes are always free)
--   * clients can no longer write language rows directly: set_language_profile() is the only way
--
-- user_languages is kept as a derived copy (one native row + at most one learning row) so the
-- existing reads (search_people, home_feed, get_profile, user_languages_json) keep working
-- until the matching rewrite replaces them.
--
-- NOTE: this migration trims extra rows in user_languages for people who had several languages.
-- Their first native and first learning language are kept. This cannot be undone from SQL.
-- Run on a throwaway Supabase project first.

-- ---------- 1. Columns and constraints on profiles ----------
alter table public.profiles
  add column if not exists native_language_id      text references public.languages(id),
  add column if not exists learning_language_id    text references public.languages(id),
  add column if not exists learning_level          text,
  add column if not exists last_language_change_at timestamptz;

alter table public.profiles drop constraint if exists profiles_learning_level_chk;
alter table public.profiles add  constraint profiles_learning_level_chk
  check (learning_level is null or learning_level in ('A1','A2','B1','B2','C1','C2'));

alter table public.profiles drop constraint if exists profiles_language_pair_chk;
alter table public.profiles add  constraint profiles_language_pair_chk
  check (learning_language_id is null or learning_language_id <> native_language_id);

alter table public.profiles drop constraint if exists profiles_learning_level_pair_chk;
alter table public.profiles add  constraint profiles_learning_level_pair_chk
  check ((learning_language_id is null) = (learning_level is null));

-- ---------- 2. Backfill from the old many-languages table ----------
-- Which one survives when someone had several? Native: prefer a language that is not English
-- (English is most often a second language), then alphabetical. Learning: the one they are
-- furthest along in (highest CEFR level), then alphabetical. The first change after this is free,
-- so anyone who disagrees can fix it once without waiting.
update public.profiles p
set native_language_id = (
  select ul.language_id from public.user_languages ul
  where ul.user_id = p.id and ul.role = 'native' order by (ul.language_id = 'eng'), ul.language_id limit 1)
where p.native_language_id is null;

update public.profiles p
set learning_language_id = x.language_id,
    learning_level = case when x.level in ('A1','A2','B1','B2','C1','C2') then x.level else 'A1' end
from (
  select distinct on (ul.user_id) ul.user_id, ul.language_id, ul.level
  from public.user_languages ul join public.profiles p2 on p2.id = ul.user_id
  where ul.role = 'learning' and ul.language_id is distinct from p2.native_language_id
  order by ul.user_id,
           case ul.level when 'C2' then 6 when 'C1' then 5 when 'B2' then 4 when 'B1' then 3 when 'A2' then 2 else 1 end desc,
           ul.language_id) x
where p.id = x.user_id and p.learning_language_id is null;

-- Keep the derived copy identical to the profile for everyone who has a native language.
delete from public.user_languages ul
using public.profiles p
where ul.user_id = p.id and p.native_language_id is not null
  and not ((ul.role = 'native'   and ul.language_id = p.native_language_id)
        or (ul.role = 'learning' and ul.language_id = p.learning_language_id));

-- ---------- 3. Launch list: 40 languages ----------
-- Keep this list identical to the update at the end of supabase/seed.sql.
update public.languages set is_supported_learning = (id in (
  'eng','swh','vie','kik','fra','spa','deu','por','ita','zho',
  'jpn','kor','hin','ara','rus','tur','ind','tha','nld','pol',
  'ukr','ell','heb','pes','ben','urd','tgl','msa','amh','som',
  'yor','ibo','hau','zul','kin','luo','kal','luy','kam','guz'));

-- ---------- 4. Close the direct-write hole ----------
-- 0001 let any signed-in user insert/update/delete their own user_languages rows through the
-- API, skipping every rule. The select policy ("languages readable") stays.
drop policy if exists "own languages" on public.user_languages;
drop function if exists public.set_my_languages(jsonb);

-- ---------- 5. Language columns cannot be edited from the client ----------
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance
       or new.native_language_id      is distinct from old.native_language_id
       or new.learning_language_id    is distinct from old.learning_language_id
       or new.learning_level          is distinct from old.learning_level
       or new.last_language_change_at is distinct from old.last_language_change_at then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

-- ---------- 6. The one way to set languages ----------
create or replace function public.set_language_profile(p_native text, p_learning text default null, p_level text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_native text := public.normalize_language_code(p_native);
  v_learning text := public.normalize_language_code(nullif(btrim(coalesce(p_learning, '')), ''));
  v_level text := nullif(upper(btrim(coalesce(p_level, ''))), '');
  me public.profiles;
  v_changed boolean;
begin
  perform assert_active();
  select * into me from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'user_unavailable'; end if;

  if v_native is null then raise exception 'language_required'; end if;
  -- Must exist and be on the launch list (an already-saved value is always allowed to stay).
  if not exists (select 1 from public.languages l where l.id = v_native
                 and (l.is_supported_learning or v_native = me.native_language_id)) then
    raise exception 'language_unsupported';
  end if;

  if v_learning is not null then
    if v_learning = v_native then raise exception 'language_same'; end if;
    if not exists (select 1 from public.languages l where l.id = v_learning
                   and (l.is_supported_learning or v_learning = me.learning_language_id)) then
      raise exception 'language_unsupported';
    end if;
    v_level := coalesce(v_level, 'A1');
    if v_level not in ('A1','A2','B1','B2','C1','C2') then raise exception 'invalid_level'; end if;
  else
    v_level := null;
  end if;

  -- Replacing or removing an existing language is a "change". Adding one for the first time, or
  -- only changing the level, is free. A change is free once, then allowed every 30 days.
  v_changed := (me.native_language_id is not null and me.native_language_id <> v_native)
            or (me.learning_language_id is not null and me.learning_language_id is distinct from v_learning);
  if v_changed and me.last_language_change_at is not null
     and me.last_language_change_at > now() - interval '30 days' then
    raise exception 'language_change_cooldown';
  end if;

  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles
  set native_language_id = v_native,
      learning_language_id = v_learning,
      learning_level = v_level,
      last_language_change_at = case when v_changed then now() else last_language_change_at end
  where id = auth.uid();

  -- Derived copy, so existing reads keep working.
  delete from public.user_languages where user_id = auth.uid();
  insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_native, 'native', 'Native');
  if v_learning is not null then
    insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_learning, 'learning', v_level);
  end if;
end $$;

-- ---------- 7. Onboarding is complete once a username AND a native language exist ----------
create or replace function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  perform assert_active();
  select c.code into v_country from public.countries c where c.code = upper(btrim(coalesce(p_country, '')));
  update profiles set username = lower(p_username), display_name = left(btrim(p_display_name), 60), bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone, is_private = coalesce(p_is_private, false), avatar_url = coalesce(p_avatar_url, avatar_url),
    country_code = v_country
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null and native_language_id is not null) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end $$;

-- ---------- Grants (project convention) ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- The blanket grant above re-opens this one; keep it internal-only (see 0029).
revoke execute on function public.adjust_user_points(uuid, int) from public, anon, authenticated;


-- ============================================================
-- from 0031_align_with_app.sql
-- ============================================================
-- 0031: align the database with what the app now sends.
--
-- The report dialog offers 'fake_correction' and 'points_abuse' (src/lib/constants.ts), but
-- reports.reason only allowed the original seven values, so those reports failed with a check
-- violation. Keep this list identical to REPORT_REASONS in the app.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in (
  'harassment', 'spam', 'inappropriate', 'impersonation', 'underage', 'scam',
  'fake_correction', 'points_abuse', 'other'));

-- ---------- Points ledger: an audit trail behind points_balance ----------
-- The Points History page reads this table (src/services/history.ts). Clients can only READ
-- their own rows; every write goes through award_points(), which is not callable from the API.
create table if not exists public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null check (reason in ('correction_accepted', 'bounty_posted', 'bounty_answered_accepted', 'bounty_expired_refund')),
  ref_type   text not null,
  ref_id     uuid not null,
  created_at timestamptz not null default now(),
  -- One payout per user per event: replaying an event can never pay twice.
  unique (user_id, reason, ref_type, ref_id)
);
create index if not exists points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
alter table public.points_ledger enable row level security;
drop policy if exists "read own ledger" on public.points_ledger;
create policy "read own ledger" on public.points_ledger for select using (auth.uid() = user_id);

-- The only way points move. Returns false (and changes nothing) if this event was already paid.
create or replace function public.award_points(p_user uuid, p_delta int, p_reason text, p_ref_type text, p_ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  insert into public.points_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user, p_delta, p_reason, p_ref_type, p_ref)
  on conflict (user_id, reason, ref_type, ref_id) do nothing;
  if not found then return false; end if;
  perform set_config('app.bypass_protect', 'on', true);
  update public.profiles set points_balance = points_balance + p_delta where id = p_user returning points_balance into v_balance;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;
  return true;
end $$;

-- adjust_user_points let any signed-in client credit anyone any amount (closed in 0029) and
-- nothing needs it any more: award_points replaces it.
drop function if exists public.adjust_user_points(uuid, int);

-- Accepting a correction still saves the phrase; the +5 reward now goes through the ledger,
-- with limits so two accounts cannot farm points by "correcting" each other:
--   * no reward when the "correction" is the same text as the original
--   * at most 10 rewarded corrections per corrector per 24 hours
--   * at most 3 rewarded corrections per corrector for the same author per 24 hours
-- The correction is accepted and the phrase saved either way; only the reward is withheld.
create or replace function public.accept_correction(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.message_corrections; v_msg public.messages; v_reward boolean := true; v_count int;
begin
  perform assert_active();
  select mc.* into c from public.message_corrections mc join public.messages m on m.id = mc.message_id
  where mc.id = p_id and m.sender_id = auth.uid() and mc.status = 'pending';
  if not found then raise exception 'correction_unavailable'; end if;
  select * into v_msg from public.messages where id = c.message_id;

  update public.message_corrections set status = 'accepted' where id = p_id;
  perform public.save_phrase(c.suggested_text, null, null, c.message_id);

  if lower(btrim(c.suggested_text)) = lower(btrim(v_msg.body)) then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger
   where user_id = c.corrector_id and reason = 'correction_accepted' and created_at > now() - interval '24 hours';
  if v_count >= 10 then v_reward := false; end if;
  select count(*) into v_count from public.points_ledger l
   join public.message_corrections mc2 on mc2.id = l.ref_id
   join public.messages m2 on m2.id = mc2.message_id
   where l.user_id = c.corrector_id and l.reason = 'correction_accepted'
     and l.created_at > now() - interval '24 hours' and m2.sender_id = v_msg.sender_id;
  if v_count >= 3 then v_reward := false; end if;

  if v_reward then perform public.award_points(c.corrector_id, 5, 'correction_accepted', 'correction', c.id); end if;
end $$;

-- ---------- Columns the app's types and pages already expect ----------
-- messages.language_id: the Message type has it. Nothing fills it yet (the sender will pick the
-- language they are writing in); it is nullable and harmless until then.
alter table public.messages add column if not exists language_id text references public.languages(id);

-- Bounty Queue page (src/services/phrasebook.ts) filters on these. PROVISIONAL: the page is a
-- stub, there is no function that posts or pays a bounty yet, and a proper design (its own table
-- with escrow) will replace these columns. Defaults keep every existing phrase unaffected.
alter table public.saved_phrases
  add column if not exists bounty_status   text not null default 'none' check (bounty_status in ('none', 'held', 'accepted', 'expired_refunded')),
  add column if not exists bounty_cost     int,
  add column if not exists bounty_asker_id uuid references public.profiles(id) on delete set null;

-- ---------- Grants (project convention) ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;
-- The blanket grant above re-opens this one; it moves points and must stay internal-only.
revoke execute on function public.award_points(uuid, int, text, text, uuid) from public, anon, authenticated;
