-- Profiles, the language profile, sign-up guards and the avatars bucket.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text default '',
  timezone text,
  is_private boolean default false,
  created_at timestamptz default now(),
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  onboarding_done boolean not null default false,
  followers_count int not null default 0,
  following_count int not null default 0,
  updated_at timestamptz not null default now(),
  country_code text references public.countries(code) on delete set null,
  points_balance int not null default 100,
  native_language_id text references public.languages(id),
  learning_language_id text references public.languages(id),
  learning_level text,
  last_language_change_at timestamptz,
  verified_level text check ((verified_level is null) or (verified_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))),
  level_checked_at timestamptz,
  show_activity boolean not null default true,
  notification_prefs jsonb not null default '{}'::jsonb,
  accountability_exempt boolean not null default false,
  constraint profiles_language_pair_chk check ((learning_language_id is null) or (learning_language_id <> native_language_id)),
  constraint profiles_learning_level_chk check ((learning_level is null) or (learning_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))),
  constraint profiles_learning_level_pair_chk check ((learning_language_id is null) = (learning_level is null)),
  constraint username_format check ((username is null) or (username ~ '^[a-z0-9_]{3,20}$'))
);
alter table public.profiles enable row level security;
create unique index profiles_username_lower on public.profiles (lower(username));
grant select (id, username, display_name, avatar_url) on public.profiles to authenticated;

create table public.user_languages (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('native', 'learning')),
  level text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Native')),
  language_id text not null references public.languages(id) on delete cascade,
  primary key (user_id, language_id, role)
);
alter table public.user_languages enable row level security;
create index user_languages_language_role_level_idx on public.user_languages (language_id, role, level);
grant select on public.user_languages to authenticated;

create table public.banned_emails (
  email_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.banned_emails enable row level security;

create table public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;

create function public.assert_active() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then raise exception 'account_restricted'; end if;
end $$;

create function public.block_banned_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from banned_emails where email_hash = public.email_hash(new.email)) then raise exception 'signup_not_allowed'; end if;
  return new;
end $$;

create function public.save_profile(p_username text, p_display_name text, p_bio text, p_timezone text, p_is_private boolean, p_avatar_url text default null, p_country text default null)
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

create function public.can_correct_language(p_user uuid, p_language text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_language is null or exists (
    select 1 from public.profiles p
    where p.id = p_user and (
      p.native_language_id = p_language
      or (p.learning_language_id = p_language and p.verified_level in ('B1', 'B2', 'C1', 'C2'))));
$$;

create function public.touch_presence() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  if (select show_activity from profiles where id = auth.uid()) then
    insert into user_presence (user_id, last_seen_at) values (auth.uid(), now())
    on conflict (user_id) do update set last_seen_at = now();
  end if;
end $$;

create function public.set_show_activity(p_show boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active();
  update profiles set show_activity = coalesce(p_show, true) where id = auth.uid();
  if not coalesce(p_show, true) then delete from user_presence where user_id = auth.uid(); end if;
end $$;

create function public.user_languages_json(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'language_id', ul.language_id, 'role', ul.role, 'level', ul.level,
      'verified_level', case when ul.role = 'learning' then p.verified_level end,
      'native_name', l.native_name, 'english_name', l.english_name)
      order by l.english_name)
    from public.user_languages ul
    join public.languages l on l.id = ul.language_id
    join public.profiles p on p.id = ul.user_id
    where ul.user_id = p_user), '[]'::jsonb) $$;

create function public.provider_avatar(meta jsonb) returns text
language sql immutable set search_path = public as $$
  select nullif(coalesce(nullif(meta->>'avatar_url', ''), meta->>'picture'), '')
$$;

create function public.sync_provider_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_new text := public.provider_avatar(new.raw_user_meta_data); v_old text := public.provider_avatar(old.raw_user_meta_data);
begin
  if v_new is not null then
    update profiles set avatar_url = v_new
    where id = new.id and (avatar_url is null or avatar_url = '' or avatar_url = v_old) and avatar_url is distinct from v_new;
  end if;
  return new;
end $$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select paused from app_status)
     and not exists (select 1 from admin_invitations i where lower(i.email) = lower(new.email) and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
     and not exists (select 1 from super_admin_bootstrap where open_until > now()) then
    raise exception 'app_paused';
  end if;
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email,'@',1)),
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), ''));
  return new;
end $$;

create function public.get_my_profile() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid() $$;

create function public.is_allowed_avatar_url(p_user uuid, p_url text) returns boolean
language sql stable set search_path = public as $$
  select p_url ~ ('^https?://([a-z0-9-]+\.supabase\.co|127\.0\.0\.1(:[0-9]+)?|localhost(:[0-9]+)?)/storage/v1/object/public/avatars/' || p_user::text || '/[^/?#]+([?][^/#]*)?$')
      or p_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/[^[:space:]]*$' $$;

create function public.guard_avatar_url() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is null or (tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url) then return new; end if;
  if not public.is_allowed_avatar_url(new.id, new.avatar_url) then
    new.avatar_url := case when tg_op = 'UPDATE' then old.avatar_url end;
  end if;
  return new;
end $$;

create trigger auth_block_banned before insert on auth.users for each row execute function public.block_banned_signup();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger on_auth_user_meta_updated after update of raw_user_meta_data on auth.users
  for each row when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.sync_provider_avatar();
create trigger profiles_guard_avatar before insert or update of avatar_url on public.profiles for each row execute function public.guard_avatar_url();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create policy "read own languages" on public.user_languages for select to authenticated using (auth.uid() = user_id);
create policy "avatars delete own" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on function
  public.assert_active(),
  public.block_banned_signup(),
  public.save_profile(text, text, text, text, boolean, text, text),
  public.can_correct_language(uuid, text),
  public.touch_presence(),
  public.set_show_activity(boolean),
  public.user_languages_json(uuid),
  public.sync_provider_avatar(),
  public.handle_new_user(),
  public.get_my_profile(),
  public.is_allowed_avatar_url(uuid, text),
  public.guard_avatar_url()
from public, anon, authenticated, service_role;

grant execute on function
  public.assert_active(),
  public.block_banned_signup(),
  public.save_profile(text, text, text, text, boolean, text, text),
  public.can_correct_language(uuid, text),
  public.touch_presence(),
  public.set_show_activity(boolean),
  public.user_languages_json(uuid),
  public.handle_new_user(),
  public.get_my_profile()
to authenticated, service_role;
