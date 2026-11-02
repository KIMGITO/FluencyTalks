-- Two changes to the staff accounts from 20261102000010, which is already live.
-- 1. The reserved super admin address is now superadmin@thefluencytalks.com.
-- 2. Staff accounts are for running the app, not using it: they aren't listed to learners and can't act as learners.

-- ---------- 1. The address ----------
create or replace function public.super_admin_email() returns text language sql immutable as $$ select 'superadmin@thefluencytalks.com'::text $$;
grant execute on function public.super_admin_email() to service_role;

-- A super admin created on the old address moves with its password and authenticators intact.
do $$
declare v_super uuid; v_new text := public.super_admin_email();
begin
  select a.user_id into v_super from public.admin_accounts a join auth.users u on u.id = a.user_id where a.tier = 'super' and lower(u.email) <> v_new;
  if v_super is null then return; end if;
  if exists (select 1 from auth.users where lower(email) = v_new) then
    raise exception 'Another account already uses %. See "The address is already taken" in docs/ADMIN_SETUP.md', v_new;
  end if;
  update auth.users set email = v_new where id = v_super;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new)) where user_id = v_super and provider = 'email';
end $$;

-- ---------- 2. profiles.role always follows admin_accounts, even after a hand edit in the SQL console ----------
create function public.sync_staff_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.set_staff_role(old.user_id, 'user'); return old; end if;
  perform public.set_staff_role(new.user_id, new.tier);
  return new;
end $$;
create trigger admin_accounts_sync_role after insert or update of tier or delete on public.admin_accounts
  for each row execute function public.sync_staff_role();

do $$
declare r record;
begin
  for r in select p.id, coalesce(a.tier, 'user') as tier from public.profiles p left join public.admin_accounts a on a.user_id = p.id
           where p.role <> case a.tier when 'super' then 'admin' when 'admin' then 'admin' when 'moderator' then 'moderator' else 'user' end loop
    perform public.set_staff_role(r.id, r.tier);
  end loop;
end $$;

-- ---------- 3. Staff aren't listed to learners ----------
-- Search, matching and the home feed only list profiles with onboarding_done, so staff stay unset. Someone removed from staff is listed again.
-- The name sorts this after protect_profile_columns, which would otherwise refuse the change.
create function public.staff_unlisted() returns trigger language plpgsql as $$
begin
  if new.role <> 'user' then new.onboarding_done := false;
  elsif old.role <> 'user' then new.onboarding_done := new.native_language_id is not null;
  end if;
  return new;
end $$;
create trigger profiles_z_staff_unlisted before update on public.profiles for each row execute function public.staff_unlisted();
update public.profiles set onboarding_done = false where role <> 'user';

-- ---------- 4. Staff can't act as learners ----------
-- A trigger, because most of these writes arrive through security definer functions that skip RLS. Service role calls have no auth.uid() and pass.
create function public.refuse_staff_learner_action() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from admin_accounts where user_id = auth.uid()) then raise exception 'staff_account'; end if;
  if tg_table_name = 'conversation_members' then
    if exists (select 1 from admin_accounts where user_id = new.user_id) then raise exception 'staff_account'; end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['conversations','conversation_members','messages','message_reactions','message_corrections','contribution_posts','post_discussion',
                           'post_endorsements','follows','saved_partners','saved_phrases','saved_posts','level_vouches','reports'] loop
    execute format('create trigger staff_refused before insert on public.%I for each row execute function public.refuse_staff_learner_action()', t);
  end loop;
end $$;

revoke execute on function public.sync_staff_role(), public.staff_unlisted(), public.refuse_staff_learner_action() from public, anon, authenticated;
