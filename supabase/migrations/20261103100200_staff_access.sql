-- Staff accounts, tiers and MFA, the audit trail, logs and the health page.

create table public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('super', 'admin', 'moderator')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  sessions_valid_after timestamptz not null default now(),
  mfa_reset_until timestamptz,
  recovery_failures int not null default 0,
  recovery_locked_until timestamptz
);
alter table public.admin_accounts enable row level security;
create unique index admin_accounts_one_super on public.admin_accounts ((true)) where tier = 'super';

create table public.admin_invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  tier text not null check (tier in ('admin', 'moderator')),
  token_hash text not null unique,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + '72:00:00'::interval),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz
);
alter table public.admin_invitations enable row level security;
create unique index admin_invitations_one_open on public.admin_invitations (lower(email)) where accepted_at is null and revoked_at is null;

create table public.admin_recovery_codes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.admin_recovery_codes enable row level security;
create index admin_recovery_codes_user_id_idx on public.admin_recovery_codes (user_id);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,
  target_id uuid,
  target_email text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);
alter table public.app_logs enable row level security;
create index app_logs_created_at_idx on public.app_logs (created_at desc);
create index app_logs_user_id_created_at_idx on public.app_logs (user_id, created_at desc);

create table public.system_heartbeats (
  minute timestamptz primary key
);
alter table public.system_heartbeats enable row level security;

create table public.super_admin_bootstrap (
  id boolean default true primary key check (id),
  open_until timestamptz
);
alter table public.super_admin_bootstrap enable row level security;

create function public.staff_tier(p_user uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select a.tier from admin_accounts a join profiles p on p.id = a.user_id where a.user_id = p_user and p.status = 'active' $$;

create function public.jwt_amr_has(p_method text) returns boolean language sql stable as $$
  select exists (select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr') = 'array' then auth.jwt()->'amr' else '[]'::jsonb end) a
    where a->>'method' = p_method) $$;

create function public.staff_session_ok() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_after timestamptz; v_amr jsonb := auth.jwt()->'amr';
begin
  if coalesce(auth.jwt()->>'aal', '') <> 'aal2' or jsonb_typeof(v_amr) is distinct from 'array' then return false; end if;
  select sessions_valid_after into v_after from admin_accounts where user_id = auth.uid();
  if v_after is null then return false; end if;
  return public.jwt_amr_has('password') and exists (select 1 from jsonb_array_elements(v_amr) a
    where a->>'method' = 'totp' and to_timestamp((a->>'timestamp')::bigint) > date_trunc('second', v_after));
end $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.staff_tier() is not null and public.staff_session_ok() $$;

create function public.is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.staff_tier() in ('super','admin') and public.staff_session_ok() $$;

create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.staff_tier() = 'super' and public.staff_session_ok() $$;

create function public.staff_can_manage(p_target uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_me text; v_them text;
begin
  if not public.is_admin() or p_target = auth.uid() then return false; end if;
  select tier into v_me from admin_accounts where user_id = auth.uid();
  select tier into v_them from admin_accounts where user_id = p_target;
  if v_them = 'super' then return false; end if;
  return case v_me when 'super' then true when 'admin' then v_them is null or v_them = 'moderator' else v_them is null end;
end $$;

create function public.staff_assert(p_level text default 'staff') returns void
language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean := case p_level when 'super' then public.is_super_admin() when 'full' then public.is_full_admin() else public.is_admin() end;
begin
  if not v_ok then raise exception 'forbidden'; end if;
end $$;

create function public.my_staff_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_tier text := public.staff_tier();
begin
  if v_tier is null then return jsonb_build_object('is_staff', false); end if;
  return jsonb_build_object('is_staff', true, 'tier', v_tier, 'session_ok', public.staff_session_ok(),
    'used_password', public.jwt_amr_has('password'),
    'recovery_codes_left', (select count(*) from admin_recovery_codes where user_id = auth.uid() and used_at is null));
end $$;

create function public.admin_audit(p_action text, p_target uuid default null, p_detail jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into admin_audit_log (actor_id, actor_email, action, target_id, target_email, detail)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), p_action, p_target, (select email from auth.users where id = p_target), p_detail) $$;

create function public.app_log(p_level text, p_source text, p_message text, p_context jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into app_logs (level, source, message, context, user_id) values (p_level, p_source, left(p_message, 1000), coalesce(p_context, '{}'), auth.uid()) $$;

create function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() = 1 and auth.uid() is not null and coalesce(current_setting('app.bypass_protect', true), '') <> 'on' then
    if new.role <> old.role or new.status <> old.status or new.followers_count <> old.followers_count
       or new.following_count <> old.following_count or new.onboarding_done <> old.onboarding_done
       or new.points_balance <> old.points_balance
       or new.native_language_id      is distinct from old.native_language_id
       or new.learning_language_id    is distinct from old.learning_language_id
       or new.learning_level          is distinct from old.learning_level
       or new.verified_level          is distinct from old.verified_level
       or new.level_checked_at        is distinct from old.level_checked_at
       or new.last_language_change_at is distinct from old.last_language_change_at then
      raise exception 'protected_profile_column';
    end if;
  end if;
  return new;
end $$;

create function public.guard_profile_role() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.role <> 'user') or (tg_op = 'UPDATE' and new.role is distinct from old.role) then
    if coalesce(current_setting('app.staff_change', true), '') <> 'on' then
      raise exception 'staff roles change only through an invitation. See docs/ADMIN_SETUP.md';
    end if;
  end if;
  return new;
end $$;

create function public.set_staff_role(p_user uuid, p_tier text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.staff_change', 'on', true);
  perform set_config('app.bypass_protect', 'on', true);
  update profiles set role = case p_tier when 'super' then 'admin' when 'admin' then 'admin' when 'moderator' then 'moderator' else 'user' end where id = p_user;
  perform set_config('app.staff_change', 'off', true);
  perform set_config('app.bypass_protect', 'off', true);
end $$;

create function public.guard_reserved_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_new text := lower(coalesce(new.email, ''));
begin
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then return new; end if;
  if tg_op = 'UPDATE' and exists (select 1 from admin_accounts where user_id = old.id and tier = 'super') and v_new <> public.super_admin_email() then
    raise exception 'super_admin_email_is_fixed';
  end if;
  if v_new = public.super_admin_email()
     and not exists (select 1 from admin_accounts where user_id = new.id and tier = 'super')
     and not exists (select 1 from super_admin_bootstrap where open_until > now()) then
    raise exception 'reserved_email';
  end if;
  return new;
end $$;

create function public.svc_open_super_bootstrap() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from admin_accounts where tier = 'super') then raise exception 'super_admin_exists'; end if;
  update super_admin_bootstrap set open_until = now() + interval '5 minutes' where id;
end $$;

create function public.svc_finish_super_bootstrap(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from super_admin_bootstrap where open_until > now()) then raise exception 'bootstrap_not_open'; end if;
  if not exists (select 1 from auth.users where id = p_user and lower(email) = public.super_admin_email() and email_confirmed_at is not null) then raise exception 'not_the_reserved_account'; end if;
  insert into admin_accounts (user_id, tier) values (p_user, 'super');
  perform public.set_staff_role(p_user, 'super');
  update super_admin_bootstrap set open_until = null where id;
  insert into admin_audit_log (actor_email, action, target_id, target_email) values ('service role', 'super_admin_created', p_user, public.super_admin_email());
end $$;

create function public.svc_break_glass_mfa(p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select a.user_id into v_id from admin_accounts a join auth.users u on u.id = a.user_id where lower(u.email) = lower(p_email);
  if v_id is null then raise exception 'not_staff'; end if;
  update admin_accounts set sessions_valid_after = now(), mfa_reset_until = now() + interval '2 minutes', recovery_failures = 0, recovery_locked_until = null where user_id = v_id;
  insert into admin_audit_log (actor_email, action, target_id, target_email) values ('service role', 'mfa_break_glass', v_id, lower(p_email));
  return v_id;
end $$;

create function public.guard_mfa_factors() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid := coalesce(new.user_id, old.user_id); v_staff record;
begin
  select * into v_staff from admin_accounts where user_id = v_user;
  if tg_op = 'INSERT' then
    if v_staff.user_id is null then raise exception 'mfa_is_for_staff'; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.status::text = 'verified' and old.status::text <> 'verified' then
      insert into admin_audit_log (actor_id, actor_email, action, target_id, target_email, detail)
      select v_user, u.email, 'mfa_factor_verified', v_user, u.email, jsonb_build_object('name', new.friendly_name) from auth.users u where u.id = v_user;
    end if;
    return new;
  end if;
  if v_staff.user_id is null or old.status::text <> 'verified' or not exists (select 1 from auth.users where id = v_user) then return old; end if;
  if coalesce(v_staff.mfa_reset_until, '-infinity') <= now()
     and not exists (select 1 from auth.mfa_factors f where f.user_id = v_user and f.status::text = 'verified' and f.id <> old.id) then
    raise exception 'cannot_remove_last_factor';
  end if;
  insert into admin_audit_log (actor_id, actor_email, action, target_id, target_email, detail)
  select auth.uid(), (select email from auth.users where id = auth.uid()), 'mfa_factor_removed', v_user, u.email, jsonb_build_object('name', old.friendly_name) from auth.users u where u.id = v_user;
  return old;
end $$;

create function public.admin_create_invitation(p_email text, p_tier text default 'admin') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''); v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if p_tier not in ('admin','moderator') then raise exception 'invalid_tier'; end if;
  if v_email = public.super_admin_email() then raise exception 'reserved_email'; end if;
  if exists (select 1 from admin_accounts a join auth.users u on u.id = a.user_id where lower(u.email) = v_email) then raise exception 'already_staff'; end if;
  update admin_invitations set revoked_at = now() where lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into admin_invitations (email, tier, token_hash, invited_by) values (v_email, p_tier, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid()) returning id into v_id;
  perform public.admin_audit('staff_invited', null, jsonb_build_object('email', v_email, 'tier', p_tier));
  return jsonb_build_object('id', v_id, 'email', v_email, 'token', v_token, 'existing_user', exists (select 1 from auth.users where lower(email) = v_email));
end $$;

create function public.admin_revoke_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  update admin_invitations set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null returning email into v_email;
  if v_email is not null then perform public.admin_audit('invitation_revoked', null, jsonb_build_object('email', v_email)); end if;
end $$;

create function public.accept_admin_invitation(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare v_inv admin_invitations; v_email text; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from admin_invitations where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if v_inv.id is null or v_inv.revoked_at is not null then raise exception 'invite_invalid'; end if;
  if v_inv.accepted_by = v_uid then return v_inv.tier; end if;
  if v_inv.accepted_at is not null or v_inv.expires_at <= now() then raise exception 'invite_invalid'; end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is distinct from lower(v_inv.email) then raise exception 'invite_email_mismatch'; end if;
  if not exists (select 1 from profiles where id = v_uid and status = 'active') then raise exception 'account_restricted'; end if;
  if exists (select 1 from admin_accounts where user_id = v_uid) then raise exception 'already_staff'; end if;
  insert into admin_accounts (user_id, tier, invited_by) values (v_uid, v_inv.tier, v_inv.invited_by);
  perform public.set_staff_role(v_uid, v_inv.tier);
  update admin_invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform public.admin_audit('invitation_accepted', v_uid, jsonb_build_object('tier', v_inv.tier));
  return v_inv.tier;
end $$;

create function public.admin_list_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'tier', a.tier, 'status', p.status,
        'name', coalesce(p.display_name, p.username), 'created_at', a.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'mfa_factors', (select count(*) from auth.mfa_factors f where f.user_id = a.user_id and f.status::text = 'verified'),
        'recovery_codes_left', (select count(*) from admin_recovery_codes c where c.user_id = a.user_id and c.used_at is null))
      order by case a.tier when 'super' then 0 when 'admin' then 1 else 2 end, a.created_at)
      from admin_accounts a join auth.users u on u.id = a.user_id join profiles p on p.id = a.user_id), '[]'),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'tier', i.tier, 'created_at', i.created_at, 'expires_at', i.expires_at) order by i.created_at desc)
      from admin_invitations i where i.accepted_at is null and i.revoked_at is null and i.expires_at > now()), '[]'));
end $$;

create function public.admin_remove_staff(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if not exists (select 1 from admin_accounts where user_id = p_user and tier <> 'super') then raise exception 'forbidden'; end if;
  perform public.admin_audit('staff_removed', p_user, jsonb_build_object('reason', v_reason));
  delete from admin_accounts where user_id = p_user;
  delete from admin_recovery_codes where user_id = p_user;
  perform public.set_staff_role(p_user, 'user');
end $$;

create function public.admin_prepare_mfa_reset(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_super_admin() then raise exception 'forbidden'; end if;
  if v_reason is null then raise exception 'reason_required'; end if;
  if not exists (select 1 from admin_accounts where user_id = p_user and tier <> 'super') then raise exception 'forbidden'; end if;
  update admin_accounts set sessions_valid_after = now(), mfa_reset_until = now() + interval '2 minutes', recovery_failures = 0, recovery_locked_until = null where user_id = p_user;
  delete from admin_recovery_codes where user_id = p_user;
  perform public.admin_audit('mfa_reset', p_user, jsonb_build_object('reason', v_reason));
end $$;

create function public.recovery_code_hash(p_user uuid, p_code text) returns text language sql immutable as $$
  select encode(sha256(convert_to(p_user::text || ':' || lower(replace(btrim(coalesce(p_code, '')), '-', '')), 'UTF8')), 'hex') $$;

create function public.admin_generate_recovery_codes() returns text[]
language plpgsql security definer set search_path = public as $$
declare v_codes text[] := '{}'; v_raw text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from admin_recovery_codes where user_id = auth.uid();
  for i in 1..10 loop
    v_raw := left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 20);
    insert into admin_recovery_codes (user_id, code_hash) values (auth.uid(), public.recovery_code_hash(auth.uid(), v_raw));
    v_codes := v_codes || (left(v_raw, 5) || '-' || substr(v_raw, 6, 5) || '-' || substr(v_raw, 11, 5) || '-' || right(v_raw, 5));
  end loop;
  perform public.admin_audit('recovery_codes_generated', auth.uid());
  return v_codes;
end $$;

create function public.admin_redeem_recovery_code(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_acc admin_accounts; v_code uuid; v_super uuid;
begin
  select * into v_acc from admin_accounts where user_id = auth.uid() for update;
  if v_acc.user_id is null then raise exception 'forbidden'; end if;
  if not (public.jwt_amr_has('password') or public.jwt_amr_has('otp') or public.jwt_amr_has('recovery')) then raise exception 'forbidden'; end if;
  if v_acc.recovery_locked_until > now() then raise exception 'recovery_locked'; end if;
  select id into v_code from admin_recovery_codes where user_id = auth.uid() and used_at is null and code_hash = public.recovery_code_hash(auth.uid(), p_code);
  if v_code is null then
    update admin_accounts set recovery_failures = recovery_failures + 1,
      recovery_locked_until = case when recovery_failures + 1 >= 5 then now() + interval '1 hour' end where user_id = auth.uid();
    perform public.admin_audit('recovery_code_failed', auth.uid());
    return false;   -- not an exception: raising would roll back the failure count
  end if;
  update admin_recovery_codes set used_at = now() where id = v_code;
  update admin_accounts set recovery_failures = 0, recovery_locked_until = null, sessions_valid_after = now(), mfa_reset_until = now() + interval '2 minutes' where user_id = auth.uid();
  perform public.admin_audit('recovery_code_used', auth.uid());
  select user_id into v_super from admin_accounts where tier = 'super';
  perform public.notify_event(v_super, null, 'admin_security', jsonb_build_object('event', 'recovery_code_used'), 'recovery:' || v_code, true);
  return true;
end $$;

create function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default null, p_report uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'invalid_status'; end if;
  if not public.staff_can_manage(p_user) then raise exception 'forbidden'; end if;
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

create function public.admin_search_users(p_query text default null)
returns table (id uuid, username text, display_name text, role text, status text, created_at timestamptz, open_reports int, manageable boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_query, '')), ''); v_like text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_q is not null then v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return query
    select p.id, p.username, p.display_name, p.role, p.status, p.created_at,
           (select count(*)::int from reports r where r.target_user_id = p.id and r.status = 'open'),
           public.staff_can_manage(p.id)
    from profiles p
    where p.username is not null and (v_like is null or p.username ilike v_like or p.display_name ilike v_like)
    order by (p.status <> 'active') desc, p.created_at desc
    limit 50;
end $$;

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from profiles),
    'users_new_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_active_24h', (select count(*) from user_presence where last_seen_at > now() - interval '24 hours'),
    'users_suspended', (select count(*) from profiles where status = 'suspended'),
    'users_banned', (select count(*) from profiles where status = 'banned'),
    'reports_open', (select count(*) from reports where status = 'open'),
    'reports_oldest_open', (select min(created_at) from reports where status = 'open'),
    'appeals_open', (select count(*) from restriction_appeals where status = 'open'),
    'decisions_escalated', (select count(*) from decision_items where resolved_at is null and escalated_at is not null),
    'restrictions_active', (select count(*) from user_restrictions where lifted_at is null),
    'messages_24h', (select count(*) from messages where created_at > now() - interval '24 hours'),
    'posts_7d', (select count(*) from contribution_posts where created_at > now() - interval '7 days'),
    'errors_24h', (select count(*) from app_logs where level = 'error' and created_at > now() - interval '24 hours'));
end $$;

create function public.uptime_percent(p_window interval) returns numeric
language sql stable security definer set search_path = public as $$
  with b as (select min(minute) as first_beat, count(*) filter (where minute >= now() - p_window) as beats from system_heartbeats)
  select case when first_beat is null then null
    else round(least(100, 100.0 * beats / greatest(1, ceil(extract(epoch from now() - greatest(first_beat, now() - p_window)) / 60)))::numeric, 3) end from b $$;

create function public.admin_system_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_migration text; v_cron jsonb;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  begin
    execute 'select max(version) from supabase_migrations.schema_migrations' into v_migration;
  exception when others then v_migration := null; end;
  begin
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_status', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
        'last_run', (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1))), '[]') from cron.job j$q$ into v_cron;
  exception when others then v_cron := null; end;
  return jsonb_build_object(
    'checked_at', now(),
    'database', jsonb_build_object(
      'started_at', pg_postmaster_start_time(),
      'version', split_part(version(), ' ', 2),
      'size_bytes', pg_database_size(current_database()),
      'connections', (select count(*) from pg_stat_activity where datname = current_database()),
      'max_connections', current_setting('max_connections')::int,
      'long_queries', (select count(*) from pg_stat_activity where datname = current_database() and state = 'active' and now() - query_start > interval '1 minute'),
      'cache_hit_percent', (select round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) from pg_stat_database where datname = current_database()),
      'deadlocks', (select deadlocks from pg_stat_database where datname = current_database()),
      'latest_migration', v_migration),
    'tables', coalesce((select jsonb_agg(t) from (select c.relname as name, pg_total_relation_size(c.oid) as bytes, c.reltuples::bigint as rows
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 8) t), '[]'),
    'uptime', jsonb_build_object('last_beat', (select max(minute) from system_heartbeats), 'd1', public.uptime_percent('1 day'), 'd7', public.uptime_percent('7 days'), 'd30', public.uptime_percent('30 days')),
    'jobs', v_cron,
    'security', jsonb_build_object(
      'staff_total', (select count(*) from admin_accounts),
      'staff_without_mfa', (select count(*) from admin_accounts a where not exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status::text = 'verified')),
      'staff_low_on_codes', (select count(*) from admin_accounts a where (select count(*) from admin_recovery_codes c where c.user_id = a.user_id and c.used_at is null) < 3),
      'open_invitations', (select count(*) from admin_invitations where accepted_at is null and revoked_at is null and expires_at > now()),
      'failed_mfa_24h', (select count(*) from admin_audit_log where action = 'mfa_failed' and created_at > now() - interval '24 hours'),
      'failed_recovery_24h', (select count(*) from admin_audit_log where action = 'recovery_code_failed' and created_at > now() - interval '24 hours'),
      'accounts_locked', (select count(*) from admin_accounts where recovery_locked_until > now())));
end $$;

create function public.admin_logs(p_level text default null, p_limit int default 100, p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(l)) from (select a.id, a.level, a.source, a.message, a.context, a.created_at, p.username
    from app_logs a left join profiles p on p.id = a.user_id
    where (p_level is null or a.level = p_level) and (p_before is null or a.id < p_before)
    order by a.id desc limit least(coalesce(p_limit, 100), 200)) l), '[]');
end $$;

create function public.admin_audit_feed(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(to_jsonb(l)) from (select id, actor_email, action, target_email, detail, created_at
    from admin_audit_log order by id desc limit least(coalesce(p_limit, 100), 200)) l), '[]');
end $$;

create function public.admin_auth_events(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_full_admin() then raise exception 'forbidden'; end if;
  begin
    execute $q$select coalesce(jsonb_agg(to_jsonb(l)), '[]') from (select id, created_at, ip_address, payload->>'action' as action, payload->>'actor_username' as actor
      from auth.audit_log_entries order by created_at desc nulls last limit $1) l$q$ into v using least(coalesce(p_limit, 100), 200);
  exception when others then v := '[]'; end;
  return v;
end $$;

create function public.log_client_error(p_message text, p_context jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare v_context jsonb := coalesce(p_context, '{}');
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_message, '')), '') is null then return; end if;
  if (select count(*) from app_logs where user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then return; end if;
  if length(v_context::text) > 4000 then v_context := jsonb_build_object('truncated', true); end if;
  perform public.app_log('error', 'browser', p_message, v_context);
end $$;

create function public.report_mfa_failure() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_accounts where user_id = auth.uid()) then return; end if;
  if (select count(*) from admin_audit_log where actor_id = auth.uid() and action = 'mfa_failed' and created_at > now() - interval '10 minutes') >= 20 then return; end if;
  perform public.admin_audit('mfa_failed', auth.uid());
end $$;

create function public.super_admin_email() returns text language sql immutable as $$ select 'superadmin@thefluencytalks.com'::text $$;

create function public.sync_staff_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.set_staff_role(old.user_id, 'user'); return old; end if;
  perform public.set_staff_role(new.user_id, new.tier);
  return new;
end $$;

create function public.staff_unlisted() returns trigger language plpgsql as $$
begin
  if new.role <> 'user' then new.onboarding_done := false;
  elsif old.role <> 'user' then new.onboarding_done := new.native_language_id is not null;
  end if;
  return new;
end $$;

create function public.refuse_staff_learner_action() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from admin_accounts where user_id = auth.uid()) then raise exception 'staff_account'; end if;
  if tg_table_name = 'conversation_members' then
    if exists (select 1 from admin_accounts where user_id = new.user_id) then raise exception 'staff_account'; end if;
  end if;
  return new;
end $$;

create function public.system_heartbeat() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into system_heartbeats (minute) values (date_trunc('minute', now())) on conflict do nothing;
end $$;

create trigger staff_guard_mfa_factors before insert or delete or update on auth.mfa_factors for each row execute function public.guard_mfa_factors();
create trigger auth_guard_reserved_email before insert or update of email on auth.users
  for each row execute function public.guard_reserved_email();
create trigger admin_accounts_sync_role after insert or update of tier or delete on public.admin_accounts
  for each row execute function public.sync_staff_role();
create trigger profiles_guard_role before insert or update of role on public.profiles for each row execute function public.guard_profile_role();
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();
create trigger profiles_z_staff_unlisted before update on public.profiles for each row execute function public.staff_unlisted();

revoke all on function
  public.staff_tier(uuid),
  public.jwt_amr_has(text),
  public.staff_session_ok(),
  public.is_admin(),
  public.is_full_admin(),
  public.is_super_admin(),
  public.staff_can_manage(uuid),
  public.staff_assert(text),
  public.my_staff_status(),
  public.admin_audit(text, uuid, jsonb),
  public.app_log(text, text, text, jsonb),
  public.protect_profile_columns(),
  public.guard_profile_role(),
  public.set_staff_role(uuid, text),
  public.guard_reserved_email(),
  public.svc_open_super_bootstrap(),
  public.svc_finish_super_bootstrap(uuid),
  public.svc_break_glass_mfa(text),
  public.guard_mfa_factors(),
  public.admin_create_invitation(text, text),
  public.admin_revoke_invitation(uuid),
  public.accept_admin_invitation(text),
  public.admin_list_team(),
  public.admin_remove_staff(uuid, text),
  public.admin_prepare_mfa_reset(uuid, text),
  public.recovery_code_hash(uuid, text),
  public.admin_generate_recovery_codes(),
  public.admin_redeem_recovery_code(text),
  public.admin_set_user_status(uuid, text, text, uuid),
  public.admin_search_users(text),
  public.admin_overview(),
  public.uptime_percent(interval),
  public.admin_system_health(),
  public.admin_logs(text, integer, bigint),
  public.admin_audit_feed(integer),
  public.admin_auth_events(integer),
  public.log_client_error(text, jsonb),
  public.report_mfa_failure(),
  public.super_admin_email(),
  public.sync_staff_role(),
  public.staff_unlisted(),
  public.refuse_staff_learner_action(),
  public.system_heartbeat()
from public, anon, authenticated, service_role;

grant execute on function
  public.is_full_admin(),
  public.is_super_admin(),
  public.staff_can_manage(uuid),
  public.staff_assert(text),
  public.my_staff_status(),
  public.admin_create_invitation(text, text),
  public.admin_revoke_invitation(uuid),
  public.accept_admin_invitation(text),
  public.admin_list_team(),
  public.admin_remove_staff(uuid, text),
  public.admin_prepare_mfa_reset(uuid, text),
  public.admin_generate_recovery_codes(),
  public.admin_redeem_recovery_code(text),
  public.admin_search_users(text),
  public.admin_overview(),
  public.admin_system_health(),
  public.admin_logs(text, integer, bigint),
  public.admin_audit_feed(integer),
  public.admin_auth_events(integer),
  public.log_client_error(text, jsonb),
  public.report_mfa_failure()
to authenticated;

grant execute on function
  public.is_admin(),
  public.protect_profile_columns(),
  public.admin_set_user_status(uuid, text, text, uuid)
to authenticated, service_role;

grant execute on function
  public.svc_open_super_bootstrap(),
  public.svc_finish_super_bootstrap(uuid),
  public.svc_break_glass_mfa(text),
  public.super_admin_email()
to service_role;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('ft-system-heartbeat', '* * * * *', 'select public.system_heartbeat()');
exception when others then
  raise notice 'pg_cron unavailable (%), uptime history stays empty', sqlerrm;
end $$;
