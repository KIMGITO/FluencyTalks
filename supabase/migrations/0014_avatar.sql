-- 0014: Provider avatar backfill from auth (Google, Apple, etc).
-- Handles new signups and one-off backfill for existing users.

-- ---------- handle_new_user function (updated) ----------

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email,'@',1)),
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), ''));
  return new;
end $$;

-- ---------- One-off backfill for existing rows ----------

-- Backfill rows created before this migration (only where empty).
update public.profiles p set avatar_url = u.raw_user_meta_data->>'avatar_url'
from auth.users u where u.id = p.id and (p.avatar_url is null or p.avatar_url = '')
  and nullif(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), '') is not null;

update public.profiles p set avatar_url = u.raw_user_meta_data->>'picture'
from auth.users u where u.id = p.id and (p.avatar_url is null or p.avatar_url = '')
  and nullif(u.raw_user_meta_data->>'picture', '') is not null;