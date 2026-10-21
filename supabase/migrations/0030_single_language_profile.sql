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
  select ul.language_code from public.user_languages ul
  where ul.user_id = p.id and ul.role = 'native' order by (ul.language_code = 'eng'), ul.language_code limit 1)
where p.native_language_id is null;

update public.profiles p
set learning_language_id = x.language_code,
    learning_level = case when x.level in ('A1','A2','B1','B2','C1','C2') then x.level else 'A1' end
from (
  select distinct on (ul.user_id) ul.user_id, ul.language_code, ul.level
  from public.user_languages ul join public.profiles p2 on p2.id = ul.user_id
  where ul.role = 'learning' and ul.language_code is distinct from p2.native_language_id
  order by ul.user_id,
           case ul.level when 'C2' then 6 when 'C1' then 5 when 'B2' then 4 when 'B1' then 3 when 'A2' then 2 else 1 end desc,
           ul.language_code) x
where p.id = x.user_id and p.learning_language_id is null;

-- Keep the derived copy identical to the profile for everyone who has a native language.
delete from public.user_languages ul
using public.profiles p
where ul.user_id = p.id and p.native_language_id is not null
  and not ((ul.role = 'native'   and ul.language_code = p.native_language_id)
        or (ul.role = 'learning' and ul.language_code = p.learning_language_id));

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
