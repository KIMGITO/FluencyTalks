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
