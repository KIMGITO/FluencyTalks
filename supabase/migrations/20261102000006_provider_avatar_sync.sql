-- Google photo as the default avatar, everywhere.
-- handle_new_user already copies it on a Google sign-up. This also covers:
--   * an email account that links Google later (auth.users metadata changes, no insert),
--   * Google changing the photo URL (it does, on a new sign-in with a new picture),
--   * rows that are still empty (backfill below).
-- A photo the user uploaded themselves is never replaced: we only write when the stored
-- avatar is empty or still equals the previous Google photo.

create or replace function public.provider_avatar(meta jsonb) returns text
language sql immutable set search_path = public as $$
  select nullif(coalesce(nullif(meta->>'avatar_url', ''), meta->>'picture'), '')
$$;

create or replace function public.sync_provider_avatar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_new text := public.provider_avatar(new.raw_user_meta_data); v_old text := public.provider_avatar(old.raw_user_meta_data);
begin
  if v_new is not null then
    update profiles set avatar_url = v_new
    where id = new.id and (avatar_url is null or avatar_url = '' or avatar_url = v_old) and avatar_url is distinct from v_new;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_meta_updated on auth.users;
create trigger on_auth_user_meta_updated after update of raw_user_meta_data on auth.users
  for each row when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.sync_provider_avatar();

update public.profiles p set avatar_url = public.provider_avatar(u.raw_user_meta_data)
from auth.users u
where u.id = p.id and (p.avatar_url is null or p.avatar_url = '') and public.provider_avatar(u.raw_user_meta_data) is not null;

revoke execute on function public.sync_provider_avatar() from public, anon, authenticated;
