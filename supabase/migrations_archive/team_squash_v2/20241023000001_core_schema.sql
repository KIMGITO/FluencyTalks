-- 20241023000001: Core Schema (Tables)
create table public.languages (
  id text primary key check (id ~ '^[a-z]{3}$'),
  iso_639_1 text unique check (iso_639_1 is null or iso_639_1 ~ '^[a-z]{2}$'),
  english_name text not null check (char_length(btrim(english_name)) between 1 and 80),
  native_name text check (native_name is null or char_length(btrim(native_name)) between 1 and 80),
  is_supported_learning boolean not null default true
);
create index languages_supported_learning_idx on public.languages (is_supported_learning, english_name);
alter table public.languages enable row level security;
create policy "languages public read" on public.languages for select using (true);
create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null
);
alter table public.countries enable row level security;
create policy "countries public read" on public.countries for select using (true);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text default '',
  timezone text,
  country_code text references public.countries(code),
  is_private boolean default false,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','suspended','banned')),
  onboarding_done boolean not null default false,
  followers_count int not null default 0,
  following_count int not null default 0,
  points_balance int not null default 100,
  native_language_id text references public.languages(id),
  learning_language_id text references public.languages(id),
  learning_level text check (learning_level is null or learning_level in ('A1','A2','B1','B2','C1','C2')),
  last_language_change_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint profiles_language_pair_chk check (learning_language_id is null or learning_language_id <> native_language_id),
  constraint profiles_learning_level_pair_chk check ((learning_language_id is null) = (learning_level is null)),
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$')
);
create unique index profiles_username_lower on public.profiles (lower(username));
alter table public.profiles enable row level security;
create table public.user_languages (
  user_id uuid references public.profiles(id) on delete cascade,
  language_id text references public.languages(id) on delete cascade,
  role text check (role in ('native','learning')) not null,
  level text check (level in ('A1','A2','B1','B2','C1','C2','Native')),
  primary key (user_id, language_id, role)
);
alter table public.user_languages enable row level security;
create policy "languages readable" on public.user_languages for select using (true);
create policy "own languages" on public.user_languages for all using (auth.uid() = user_id);
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  followee_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('pending','accepted')) default 'accepted',
  created_at timestamptz default now(), primary key (follower_id, followee_id)
);
create index on public.follows (followee_id);
alter table public.follows enable row level security;
create policy "follow as self" on public.follows for all using (auth.uid() = follower_id);
create policy "see own follow rows" on public.follows for select using (auth.uid() in (follower_id, followee_id));
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(), primary key (blocker_id, blocked_id)
);
create index on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "manage own blocks" on public.blocks for all using (auth.uid() = blocker_id);
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
create table public.banned_emails (email_hash text primary key, created_at timestamptz not null default now());
alter table public.banned_emails enable row level security;
create table public.consents (
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('terms','privacy','age_18')),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, kind, version)
);
alter table public.consents enable row level security;
create policy "read own consents" on public.consents for select using (auth.uid() = user_id);

-- ---------- 5. Triggers & Core Logic ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email,'@',1)),
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin','moderator') and status = 'active');
$$;

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
end;
$$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();


-- ---------- 6. Core RPCs ----------
create or replace function public.assert_active() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then raise exception 'account_restricted'; end if;
end;
$$;
create or replace function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  perform assert_active();
  select c.code into v_country from public.countries c where c.code = upper(btrim(coalesce(p_country, '')));
  update profiles set
    username = lower(p_username),
    display_name = left(btrim(p_display_name), 60),
    bio = left(coalesce(p_bio, ''), 300),
    timezone = p_timezone,
    is_private = coalesce(p_is_private, false),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    country_code = v_country
  where id = auth.uid();
  if exists (select 1 from profiles where id = auth.uid() and username is not null and native_language_id is not null) then
    perform set_config('app.bypass_protect', 'on', true);
    update profiles set onboarding_done = true where id = auth.uid();
  end if;
end;
$$;
create or replace function public.user_languages_json(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'language_id', ul.language_id, 'role', ul.role, 'level', ul.level,
      'native_name', l.native_name, 'english_name', l.english_name) order by (ul.role = 'native') desc)
    from user_languages ul
    join languages l on l.id = ul.language_id
    where ul.user_id = p_user
  ), '[]'::jsonb);
$$;


create or replace function public.list_follows(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
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
end;
$$;
create or replace function public.set_language_profile(v_native text, v_learning text, v_level text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_changed boolean;
begin
  perform assert_active();
  select * into me from public.profiles where id = auth.uid();
  v_native := lower(btrim(v_native));
  v_learning := lower(btrim(v_learning));
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
  delete from public.user_languages where user_id = auth.uid();
  insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_native, 'native', 'Native');
  if v_learning is not null then
    insert into public.user_languages (user_id, language_id, role, level) values (auth.uid(), v_learning, 'learning', v_level);
  end if;
end;
$$;
-- ---------- 7. Policies & Grants ----------
create policy "profiles readable unless blocked" on public.profiles for select using (
  not exists (select 1 from public.blocks b where (b.blocker_id = id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = id)));
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

