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