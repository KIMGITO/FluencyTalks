-- Add status column to profiles to fix trigger dependencies
alter table public.profiles
  add column if not exists status text not null default 'active' 
  check (status in ('active', 'removed'));

-- Fix the trigger function to handle the new status column
create or replace function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status or new.followers_count is distinct from old.followers_count
       or new.following_count is distinct from old.following_count or new.onboarding_done is distinct from old.onboarding_done
       or new.points_balance is distinct from old.points_balance
       or new.native_language_id      is distinct from old.native_language_id
       or new.learning_language_id    is distinct from old.learning_language_id
       or new.learning_level          is distinct from old.learning_level
       or new.last_language_change_at is distinct from old.last_language_change_at then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;
